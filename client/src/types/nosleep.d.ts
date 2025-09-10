declare module 'nosleep.js' {
  export default class NoSleep {
    constructor();
    enable(): void | Promise<void>;
    disable(): void;
  }
}