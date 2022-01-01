export default class Queue {
    callbacks = [];
    pending = false;
    add = (cb)=>{
        if (!this.pending) {
            this.callbacks.push(cb);
        }
    }
    flush = ()=>{
        if (this.callbacks.length === 0) {
            return
        }
        if (this.pending) {
            this.pending = true;
        }
        const currentCb = this.callbacks.pop();
        this.callbacks = [];
        currentCb && currentCb();
        this.pending = false;
    }
}