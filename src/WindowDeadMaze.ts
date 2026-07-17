import { TeWindow } from "./TeWindow";

export class WindowDeadMaze extends TeWindow {
    constructor(httpUrl: string) {
        super(httpUrl);
        this.windowTitle = "DeadMaze";
        this.windowBgColor = "#000000";
        this.windowWidth = 1044;
        this.windowHeight = 632;
    }

    load() {
        this.browserWindow.loadURL(this.httpUrl + "/deadmaze.html");
    }
}