export class InputManager {
    handlers;
    touchStartX = 0;
    touchStartY = 0;
    minSwipeDistance = 30;
    isListening = false;
    constructor(handlers) {
        this.handlers = handlers;
    }
    attach(canvasElement) {
        if (this.isListening)
            return;
        this.isListening = true;
        // 1. Keyboard Controls
        window.addEventListener('keydown', this.handleKeyDown);
        // 2. Touch Gestures (Swipe) on Canvas
        canvasElement.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        canvasElement.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    }
    detach(canvasElement) {
        if (!this.isListening)
            return;
        this.isListening = false;
        window.removeEventListener('keydown', this.handleKeyDown);
        canvasElement.removeEventListener('touchstart', this.handleTouchStart);
        canvasElement.removeEventListener('touchend', this.handleTouchEnd);
    }
    handleKeyDown = (e) => {
        // Ignore input if user is focusing an input field or modal textarea
        if (document.activeElement &&
            (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            return;
        }
        let handled = true;
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
            case 'k':
                this.handlers.onAction('UP');
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
            case 'j':
                this.handlers.onAction('DOWN');
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
            case 'h':
                this.handlers.onAction('LEFT');
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
            case 'l':
                this.handlers.onAction('RIGHT');
                break;
            case ' ': // Spacebar
            case 'z':
            case 'Z':
            case '.':
                this.handlers.onAction('WAIT');
                break;
            case 'u':
            case 'U':
            case 'Backspace':
                this.handlers.onUndo();
                break;
            case 'r':
            case 'R':
                this.handlers.onRestart();
                break;
            case 'm':
            case 'M':
                if (this.handlers.onMuteToggle)
                    this.handlers.onMuteToggle();
                break;
            default:
                handled = false;
                break;
        }
        if (handled) {
            e.preventDefault();
        }
    };
    handleTouchStart = (e) => {
        if (e.touches.length === 1) {
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
        }
    };
    handleTouchEnd = (e) => {
        if (e.changedTouches.length === 1) {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const dx = endX - this.touchStartX;
            const dy = endY - this.touchStartY;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            if (absX >= this.minSwipeDistance || absY >= this.minSwipeDistance) {
                e.preventDefault();
                if (absX > absY) {
                    if (dx > 0) {
                        this.handlers.onAction('RIGHT');
                    }
                    else {
                        this.handlers.onAction('LEFT');
                    }
                }
                else {
                    if (dy > 0) {
                        this.handlers.onAction('DOWN');
                    }
                    else {
                        this.handlers.onAction('UP');
                    }
                }
            }
        }
    };
}
