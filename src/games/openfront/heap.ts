// File de priorité minimale sur des numéros de case : la case de plus petite priorité sort d'abord.
export class Heap {
  private items = new Int32Array(64)
  private keys = new Float64Array(64)
  size = 0

  push(item: number, key: number) {
    if (this.size === this.items.length) {
      const items = new Int32Array(this.size * 2)
      const keys = new Float64Array(this.size * 2)
      items.set(this.items)
      keys.set(this.keys)
      this.items = items
      this.keys = keys
    }
    let i = this.size++
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.keys[parent] <= key) break
      this.items[i] = this.items[parent]
      this.keys[i] = this.keys[parent]
      i = parent
    }
    this.items[i] = item
    this.keys[i] = key
  }

  pop(): number {
    const top = this.items[0]
    const item = this.items[--this.size]
    const key = this.keys[this.size]
    let i = 0
    for (;;) {
      let child = 2 * i + 1
      if (child >= this.size) break
      if (child + 1 < this.size && this.keys[child + 1] < this.keys[child]) child++
      if (this.keys[child] >= key) break
      this.items[i] = this.items[child]
      this.keys[i] = this.keys[child]
      i = child
    }
    this.items[i] = item
    this.keys[i] = key
    return top
  }
}
