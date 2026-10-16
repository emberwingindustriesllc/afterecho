export class InputManager {
    handlers;
    touchStartX = 0;
    touchStartY = 0;
    minSwipeDistance = 28;
    isListening = false;
    lastTouchTime = 0;
    constructor(handlers) {
        this.handlers = handlers;
    }
    attach(canvasElement) {
        if (this.isListening)
            return;
        this.isListening = true;
        // 1. Keyboard Controls
        window.addEventListener('keydown', this.handleKeyDown);
        // 2. Touch Gestures (Swipe & Tap) on Canvas
        canvasElement.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        canvasElement.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        // 3. Mouse Click & Hover on Canvas
        canvasElement.addEventListener('click', this.handleClick);
        canvasElement.addEventListener('mousemove', this.handleMouseMove);
        canvasElement.addEventListener('mouseleave', this.handleMouseLeave);
    }
    detach(canvasElement) {
        if (!this.isListening)
            return;
        this.isListening = false;
        window.removeEventListener('keydown', this.handleKeyDown);
        canvasElement.removeEventListener('touchstart', this.handleTouchStart);
        canvasElement.removeEventListener('touchend', this.handleTouchEnd);
        canvasElement.removeEventListener('click', this.handleClick);
        canvasElement.removeEventListener('mousemove', this.handleMouseMove);
        canvasElement.removeEventListener('mouseleave', this.handleMouseLeave);
    }
    handleKeyDown = (e) => {
        if (document.activeElement &&
            (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            return;
        }
        // Ignore shortcuts if a modal is open (except Escape to close)
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            if (e.key === 'Escape') {
                activeModal.classList.remove('active');
                e.preventDefault();
            }
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
            case 'H':
            case '?':
            case '/':
                if (this.handlers.onHint)
                    this.handlers.onHint();
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
    handleClick = (e) => {
        // Prevent duplicate synthetic click right after touch
        if (performance.now() - this.lastTouchTime < 400)
            return;
        if (this.handlers.onCanvasClick) {
            this.handlers.onCanvasClick(e.clientX, e.clientY);
        }
    };
    handleMouseMove = (e) => {
        if (this.handlers.onCanvasHover) {
            this.handlers.onCanvasHover(e.clientX, e.clientY);
        }
    };
    handleMouseLeave = () => {
        if (this.handlers.onCanvasHover) {
            this.handlers.onCanvasHover(null, null);
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
            this.lastTouchTime = performance.now();
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const dx = endX - this.touchStartX;
            const dy = endY - this.touchStartY;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            if (absX >= this.minSwipeDistance || absY >= this.minSwipeDistance) {
                e.preventDefault();
                if (absX > absY) {
                    this.handlers.onAction(dx > 0 ? 'RIGHT' : 'LEFT');
                }
                else {
                    this.handlers.onAction(dy > 0 ? 'DOWN' : 'UP');
                }
            }
            else if (absX < 14 && absY < 14 && this.handlers.onCanvasClick) {
                e.preventDefault();
                this.handlers.onCanvasClick(endX, endY);
            }
        }
    };
}
