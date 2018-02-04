function Queue(max) {
  if (!(this instanceof Queue)) return new Queue(max);
  this.max = max || 0;
  this.queue = [];
  this.pending = [];
}

Queue.prototype.push = function(item) {
  if (this.max > 0 && this.queue.length >= this.max) {
    this.queue.shift();
  }
  if (this.pending.length > 0) {
    const pending = this.pending.shift();
    pending.resolve(item);
  } else {
    this.queue.push(item);
  }
  return this;
};

Queue.prototype.throw = function(err) {
  if (this.pending.length > 0) {
    const pending = this.pending.shift();
    pending.reject(err);
  } else {
    this.queue.push(err);
  }
  return this;
};

Queue.prototype.fetch = function() {
  return new Promise((resolve, reject) => {
    if (this.queue.length > 0) {
      const item = this.queue.pop();
      item instanceof Error ? reject(item) : resolve(item);
    } else {
      this.pending.push({ resolve, reject });
    }
  });
};

module.exports = Queue;
