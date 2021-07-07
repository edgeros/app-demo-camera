export interface Camera {
    devId: string;
    alias: string;
    report: string;
    status: boolean;
    videoUrl: string;
    enableMove: boolean;
    autoMode: boolean;
    streams: Array<any>;
}
