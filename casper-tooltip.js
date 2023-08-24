/*
  - Copyright (c) 2016 Cloudware S.A. All rights reserved.
  -
  - This file is part of casper-tooltip.
  -
  - casper-tooltip is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - casper-tooltip  is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with casper-tooltip.  If not, see <http://www.gnu.org/licenses/>.
  -
 */

import { LitElement, html } from 'lit';
import DOMPurify from 'dompurify';

class CasperTooltip extends LitElement {
  static get properties () {
    return {
      tooltipPosition: {
        type: String
      },
      radius: {
        type: Number
      },
      tipHeight: {
        type: Number
      },
      tipBase: {
        type: Number
      },
      tipLocation: {
        type: Number
      },
      positionTarget: {
        type: Object
      },
      fitInto: {
        type: Object
      },
      backgroundColor: {
        type: String
      },
      backgroundAlpha: {
        type: Number
      },
      textPadding: {
        type: Number
      }
    };
  }

  constructor () {
    super();
    this.radius = 5;
    this.tipHeight = 5;
    this.tipBase = 10;
    this.tipLocation = 0.5;
    this.backgroundColor = '#000';
    this.backgroundAlpha = 0.75;
    this.textPadding = '6';
  }

  render () {
    // Style needs to be inside render so it works in old ctb epaper
    return html`
      <style>
        :host {
          display: block;
          position: absolute;
          -moz-user-select: none;
          -ms-user-select: none;
          -webkit-user-select: none;
          user-select: none;
          width: 50px;
          z-index: 200; /* to be above the wizard */
        }
        .visible {
          visibility: visible;
          opacity: 1;
          transition: visibility 0.1s, opacity 0.1s linear;
        }
        .hidden {
          visibility: hidden;
          opacity: 0;
          transition: visibility 0.5s, opacity 0.5s ease-in;
        }
        #canvas {
          position: absolute;
        }
        #text {
          color: white;
          padding: 5px;
          font-size: 10px;
          position: absolute;
          text-align: center;
          text-transform: uppercase;
          cursor: pointer;
        }
      </style>
      <canvas id="canvas"></canvas>
      <div id="text"></div>
    `;
  }

  connectedCallback () {
    super.connectedCallback();
    this.__showing = false;
    this.setVisible(false);
  }

  firstUpdated () {
    this.canvas = this.shadowRoot.getElementById('canvas');
    this.text = this.shadowRoot.getElementById('text');
    this.__canvasContext = this.canvas.getContext('2d');
    this.__setupPixelRatio();
    this.addEventListener('click', e => this.hide(e));
  }

  /**
   * Function that is called to bind mouseMovement to look for tooltips
   */
  mouseMoveToolip (event, maxDepth = 3) {
    const eventPath = event.composedPath();

    // Still inside the Tooltip -- Abort
    if (this.__tooltipBounds) {
      if (event.clientY >= this.__tooltipBounds.top &&
        event.clientX >= this.__tooltipBounds.left &&
        event.clientX <= this.__tooltipBounds.right &&
        event.clientY <= this.__tooltipBounds.bottom) return;

      this.hide();
      this.__tooltipBounds = undefined;
    }

    let depth = 0;

    // Find a tooltip, and open it at the first element.
    for (let element of eventPath) {
      if ((element instanceof HTMLElement || element instanceof SVGElement ) && element.nodeName.toLowerCase() !== 'slot') {
        // Get the tooltip's text and position.
        const tooltipText = element.tooltip || element.getAttribute('tooltip');
        const tooltipPosition = element.tooltipPosition || element.getAttribute('tooltip-position') || 'bottom';

        if (tooltipText) {
          this.__tooltipBounds = element.getBoundingClientRect();
          this.show(tooltipText, this.__tooltipBounds, tooltipPosition);
          return;
        }
      }

      if (++depth === maxDepth) break;
    }
  }

  setVisible (visible) {
    if (!this.canvas || !this.text) return;

    if (visible) {
      this.canvas.classList.remove('hidden');
      this.text.classList.remove('hidden');
      this.canvas.classList.add('visible');
      this.text.classList.add('visible');
    } else {
      this.canvas.classList.add('hidden');
      this.text.classList.add('hidden');
      this.canvas.classList.remove('visible');
      this.text.classList.remove('visible');
    }
  }

  /**
   * Layout tool tip and set text
   *
   * The bounding box of the "controlling" area is used to position the tooltip below. The arrow
   * is centered along the lower edge of the controller and body of the tooltip is adjusted to
   * fit inside the page.
   *
   * @param tooltipText The html content to put inside the tooltip.
   * @param positionTargetRect The element's bounds where the tooltip will be positioned.
   * @param tooltipPosition The position on which the tooltip should appear.
   */
  show (tooltipText, positionTargetRect, tooltipPosition = 'bottom') {
    this.tooltipPosition = tooltipPosition;

    const fitInto = this.fitInto.getBoundingClientRect();

    const isDialog = this.fitInto.nodeName === 'DIALOG'; // dialog 0,0 reference is different

    // Check if we received an object or the bounds.
    if (positionTargetRect instanceof HTMLElement) {
      positionTargetRect = positionTargetRect.getBoundingClientRect();
    }

    const positionTargetBounds = {
      width: positionTargetRect.width,
      height: positionTargetRect.height,
      top: positionTargetRect.top + (isDialog ? 0 : fitInto.top),
      left: positionTargetRect.left + (isDialog ? 0 : fitInto.left),
      bottom: positionTargetRect.top + (isDialog ? 0 : fitInto.top) + positionTargetRect.height,
      right: positionTargetRect.left + (isDialog ? 0 : fitInto.left) + positionTargetRect.width,
    };

    this.__showing = true;
    this.setVisible(true);

    // ... set text and size the tooltip, max width up to 100% of page width ...
    this.style.width = `${document.body.offsetWidth}px`;

    const purifiedHTML = DOMPurify.sanitize(tooltipText, {
      CUSTOM_ELEMENT_HANDLING: {
          tagNameCheck:/^casper-|^day-detail-/, // only casper elements are allowed
          attributeNameCheck:/icon|tooltipobject/, // only icon attribute is allowed
          allowCustomizedBuiltInElements: false, // no customized built-ins allowed
      },
    });
    this.text.innerHTML = purifiedHTML;

    this.text.style.margin = 0;
    this.text.style.padding = this.textPadding + 'px';

    const tooltipRect = this.text.getBoundingClientRect();

    let tooltipLeft, tooltipTop;
    const positionTargetCenterY = positionTargetBounds.top + positionTargetBounds.height / 2;
    const positionTargetCenterX = positionTargetBounds.left + positionTargetBounds.width / 2;

    switch (this.tooltipPosition) {
      case 'bottom':
        tooltipTop = positionTargetBounds.bottom;
        tooltipLeft = positionTargetCenterX - tooltipRect.width / 2;
        this.text.style.margin = `${this.tipHeight}px 0 0 0`;
        break;
      case 'top':
        tooltipTop = positionTargetBounds.top - tooltipRect.height - this.tipHeight;
        tooltipLeft = positionTargetCenterX - tooltipRect.width / 2;
        this.text.style.margin = `0 0 ${this.tipHeight}px 0`;
        break;
      case 'left':
        tooltipTop = positionTargetCenterY - tooltipRect.height / 2;
        tooltipLeft = positionTargetBounds.left - tooltipRect.width - this.tipBase;
        break;
      case 'right':
        tooltipTop = positionTargetCenterY - tooltipRect.height / 2;
        tooltipLeft = positionTargetBounds.right;
        this.text.style.margin = `0 0 0 ${this.tipHeight}px`;
        break;
    }

    if (tooltipLeft < fitInto.left) {
      // Left of the screen
      tooltipLeft = fitInto.left;
      this.tipLocation = (positionTargetRect.left + (positionTargetRect.width / 2)) / tooltipRect.width;
    } else if (tooltipLeft + tooltipRect.width > fitInto.left + fitInto.width) {
      // Right of the screen
      tooltipLeft = fitInto.left + fitInto.width - tooltipRect.width;
      this.tipLocation = (tooltipRect.width - (fitInto.width - positionTargetRect.left - (positionTargetRect.width / 2))) /  tooltipRect.width;
    } else {
      this.tipLocation = 0.5;
    }

    this.style.top = `${tooltipTop - fitInto.top}px`;
    this.style.left = `${tooltipLeft - fitInto.left}px`;
    this.__updateBalloon(tooltipPosition);
  }

  hide () {
    // If the tooltip is already hidden, there's nothing to do.
    if (!this.__showing) return;

    this.__showing = false;
    this.setVisible(false);
  }

  __updateBalloon (tooltipPosition) {
    let width, height;

    const tooltipTextRect = this.text.getBoundingClientRect();
    switch (tooltipPosition) {
      case 'top':
      case 'bottom':
        height = tooltipTextRect.height + this.tipHeight;
        width = tooltipTextRect.width;
        break;
      case 'left':
      case 'right':
        height = tooltipTextRect.height;
        width = tooltipTextRect.width + this.tipHeight + this.radius;
        break;
    }

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = width * this.__ratio;
    this.canvas.height = height * this.__ratio;
    this.__paintBalloon(width - 1, height - 1);
  }

  /**
   * @brief Determine the device pixel ratio: 1 on classical displays 2 on retina/UHD displays
   */
  __setupPixelRatio () {
    const devicePixelRatio = (window.devicePixelRatio || 1) > 1.6 ? 2 : 1;
    const backingStoreRatio = this.__canvasContext.webkitBackingStorePixelRatio ||
      this.__canvasContext.mozBackingStorePixelRatio ||
      this.__canvasContext.msBackingStorePixelRatio ||
      this.__canvasContext.oBackingStorePixelRatio ||
      this.__canvasContext.backingStorePixelRatio || 1;

    this.__ratio = devicePixelRatio / backingStoreRatio;
  }

  /**
   * @brief Prepares a rounded rect path, does not paint or stroke it.
   *
   * @param {Number} x Upper left corner.
   * @param {Number} y upper left corner.
   * @param {Number} w Width of the round rectangle.
   * @param {Number} h Height of the round rectangle.
   * @param {Number} r Corner radius.
   */
  __makeRoundRectPath (x, y, w, h, r) {
    this.__canvasContext.moveTo(x + r, y);
    this.__canvasContext.arcTo(x + w, y, x + w, y + r, r);
    this.__canvasContext.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.__canvasContext.arcTo(x, y + h, x, y + h - r, r);
    this.__canvasContext.arcTo(x, y, x + r, y, r);
  }

  /**
   * Paints the balloon shape on the canvas object.
   *
   * @param {Number} width The balloon's width in pixels.
   * @param {Number} height The balloon's height in pixels.
   */
  __paintBalloon (width, height) {
    let tipLocation;
    this.__canvasContext.fillStyle = this.backgroundColor;
    this.__canvasContext.globalAlpha = this.backgroundAlpha;

    const radius = this.radius * this.__ratio;
    const tipBase = this.tipBase * this.__ratio;
    const tipHeight = this.tipHeight * this.__ratio;

    width *= this.__ratio;
    height *= this.__ratio;

    this.__canvasContext.beginPath();
    switch (this.tooltipPosition) {
      case 'bottom':
        this.__makeRoundRectPath(0, 0 + tipHeight, width, height - tipHeight, radius);
        tipLocation = Math.round(0 + width * this.tipLocation);
        this.__canvasContext.moveTo(tipLocation, 0);
        this.__canvasContext.lineTo(tipLocation + Math.round(tipBase / 2), 0 + tipHeight);
        this.__canvasContext.lineTo(tipLocation - Math.round(tipBase / 2), 0 + tipHeight);
        this.__canvasContext.lineTo(tipLocation, 0);
        break;
      case 'left':
        this.__makeRoundRectPath(0, 0, width - tipHeight, height, radius);
        tipLocation = Math.round(0 + height * this.tipLocation);
        this.__canvasContext.moveTo(0 + width, tipLocation);
        this.__canvasContext.lineTo(0 + width - tipHeight, Math.round(tipLocation - tipBase / 2));
        this.__canvasContext.lineTo(0 + width - tipHeight, Math.round(tipLocation + tipBase / 2));
        this.__canvasContext.lineTo(0 + width, tipLocation);
        break;
      case 'top':
        this.__makeRoundRectPath(0, 0, width, height - tipHeight, radius);
        tipLocation = Math.round(0 + width * this.tipLocation);
        this.__canvasContext.moveTo(tipLocation, 0 + height);
        this.__canvasContext.lineTo(tipLocation + Math.round(tipBase / 2), 0 + height - tipHeight);
        this.__canvasContext.lineTo(tipLocation - Math.round(tipBase / 2), 0 + height - tipHeight);
        this.__canvasContext.lineTo(tipLocation, 0 + height);
        break;
      case 'right':
        this.__makeRoundRectPath(0 + tipHeight, 0, width - tipHeight, height, radius);
        tipLocation = Math.round(0 + height * this.tipLocation);
        this.__canvasContext.moveTo(0, tipLocation);
        this.__canvasContext.lineTo(0 + tipHeight, Math.round(tipLocation - tipBase / 2));
        this.__canvasContext.lineTo(0 + tipHeight, Math.round(tipLocation + tipBase / 2));
        this.__canvasContext.lineTo(0, tipLocation);
        break;
    }

    this.__canvasContext.closePath();
    this.__canvasContext.fill();
  }
}

window.customElements.define('casper-tooltip', CasperTooltip);