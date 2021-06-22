import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { edger } from "@edgeros/web-sdk";
import { Camera } from "../model/camera";
import { CameraService } from "../service/camera.service";
import { PermissionService } from "../service/permission.service";
import { StateService } from "../service/state.service";

declare var NodePlayer: any;
declare var MediaClient: any;
declare var createMediaClient: any;

@Component({
  selector: "app-details",
  templateUrl: "./details.page.html",
  styleUrls: ["./details.page.scss"],
})
export class DetailsPage implements OnInit {

  // 执行器
  moveTimeout: any;

  // 当前websocket是否已连接
  connected = false;

  // 长按时的移动指令数据
  moveData: any;

  // 锁：防止用户再长按时间再进行其他操作
  lock = false;

  // 是否自动追踪人脸
  autoMode = false;

  // 摄像头是否支持云台功能
  enableMove = false;

  //当前摄像头的参数
  camera: Camera = {
    devId: "none",
    alias: "none",
    report: "none",
    status: false,
    videoUrl: "none",
    enableMove: false,
    autoMode: false,
  };

  // 视频播放器插件
  np: any;

  mediaClient: any;

  // 视频大小
  mediaInfo = {
    canvaw: 360,
    canvah: 202,
  };

  // 画布
  canvas: any;

  video: any;

  cw: any;

  // 客户端高度
  clientHeight: number;
  // 客户端长度
  clientWidth: number;
  // 侧边栏高度
  sideHeight: number;

  status = true;

  show = true;

  // 方向盘伸缩状态
  stretchStatus = false;

  // 操作按钮数据
  buttons = {
    palyer: {
      color: "primary",
      icon: "play-outline",
      offIcon: "play-outline",
      openIcon: "pause-outline",
      start: false,
    },
    ai: {
      color: "primary",
      openColor: "success",
      offColor: "primary",
      icon: "./assets/icon/face.svg",
      openFace: "./assets/icon/face-open.svg",
      offFace: "./assets/icon/face-off.svg",
      start: false,
    },
    tracking: {
      color: "primary",
      openColor: "success",
      offColor: "primary",
      icon: "body-sharp",
    },
    stretch: {
      color: "primary",
      openColor: "success",
      offColor: "primary",
      icon: "./assets/icon/control.svg",
      start: false,
    },
    audio: {
      color: "primary",
      icon: "volume-high-outline",
      offIcon: "volume-mute-outline",
      openIcon: "volume-high-outline",
      start: true,
    },
    screen: {
      color: "primary",
      icon: "./assets/icon/full-screen.svg",
      openScreen: "./assets/icon/full-screen.svg",
      offScreen: "./assets/icon/shrink-screen.svg",
      start: false,
    },
  };

  constructor(
    private activatedRoute: ActivatedRoute,
    private cameraService: CameraService,
    private permissionService: PermissionService,
    private stateService: StateService
  ) {
    const page = this.getPageSize();
    this.clientHeight = page.height;
    this.clientWidth = page.width;
    this.mediaInfo.canvaw = this.clientWidth;
    this.mediaInfo.canvah = Math.round(this.clientWidth * (9 / 16));
    this.sideHeight = Math.round(this.clientWidth * (16 / 9));

    this.activatedRoute.params.subscribe((camera: any) => {
      this.camera.devId = camera.devId;
      this.camera.alias = camera.alias;
      this.camera.report = camera.report;
      this.camera.videoUrl = camera.videoUrl;
      this.camera.status = camera.status === "true";
      this.camera.enableMove = camera.enableMove === "true";
      this.camera.autoMode = camera.autoMode === "true";
      this.autoMode = this.camera.autoMode;
      this.enableMove = this.camera.enableMove;
      this.setTrackingColor();
    });
  }

  ngOnInit() {
    console.log(
      `onInit autoMode: ${this.autoMode} color: ${this.buttons.tracking.color}`
    );
    this.setStretchColor();
    this.initDom();
    this.initVideoSize();
    this.initNP();
    this.initMediaClient();
    this.initEvent();
  }

  // ionic 生命周期函数，将要进入页面时触发
  ionViewWillEnter() {
  }

  // ionic 生命周期函数，将离开页面时关闭视频
  ionViewWillLeave() {
    this.closeVideo();
  }

  /**
   * ionic 生命周期函数， 离开页面时触发
   */
  ionViewDidEnter() {
    this.mediaClient.close();
    this.np.stop();
    this.buttons.palyer.icon = this.buttons.palyer.offIcon;
  }

  getPageSize() {
    let page = {
      width: 0,
      height: 0
    }
    if (window.innerWidth && window.innerHeight) {
        page.width = window.innerWidth;
        page.height = window.innerHeight;
    } else if ((document.body) && (document.body.clientWidth) && (document.body.clientHeight)) {
        page.width = document.body.clientWidth;
        page.height = document.body.clientHeight;
    } else if (document.documentElement && document.documentElement.clientHeight && document.documentElement.clientWidth) {
        page.width = document.body.clientWidth;
        page.height = document.body.clientHeight;
    }
    return page;
  }
  /**
   * 初始化直播插件
   */
  initNP() {
    NodePlayer.load(() => {
      this.np = new NodePlayer();
      /**
       * 传入 canvas视图的id，当使用mse时，自动转换为video标签
       */
      this.np.setView("video");
      this.np.setVolume(1.0);

      /**
       * 设置最大缓冲时长，单位毫秒，只在软解时有效
       */
      this.np.setBufferTime(512);

      this.np.on("start", () => {
        console.log("player on start");
      });

      this.np.on("stop", () => {
        console.log("player on stop");
      });

      this.np.on("error", (e) => {
        console.log("player on error", e);
      });

      this.np.on("videoInfo", (w, h, codec) => {
        console.log(
          "player on video info width=" + w + " height=" + h + " codec=" + codec
        );
      });

      this.np.on("audioInfo", (r, c, codec) => {
        console.log(
          "player on audio info samplerate=" +
          r +
          " channels=" +
          c +
          " codec=" +
          codec
        );
      });

      this.np.on("stats", (stats) => {
        console.log("player on stats=", stats);
      });
    });
  }

  // 初始化dom节点
  initDom() {
    this.cw = document.getElementById("cw");
    this.canvas = document.getElementById("layout");
    this.video = document.getElementById("video");
  }

  /**
   * 初始化websocket连接
   */
  initMediaClient() {
    const payload = this.cameraService.getPayload();
    this.mediaClient = createMediaClient(
      MediaClient,
      this.getUrl(),
      this.canvas,
      {
        range: this.mediaInfo,
        log: null,
        info: null,
        error: null,
        token: payload.token,
        srand: payload.srand,
        path: this.camera.videoUrl,
      },
      (client, path) => {
        this.np.start(this.getUrl() + path);
      }
    );

    this.mediaClient.on("open", (client) => {
      this.connected = true;
      this.buttons.palyer.start = true;
      this.buttons.palyer.icon = this.buttons.palyer.openIcon;
    });

    this.mediaClient.on("close", (client) => {
      this.connected = false;
      this.buttons.palyer.start = false;
      this.buttons.palyer.icon = this.buttons.palyer.offIcon;
      this.buttons.stretch.start = false;
      this.setStretchColor();
      this.setStretch();
    });

    this.mediaClient.on("camera-sync", (ret) => {
      this.autoMode = ret;
      this.setTrackingColor();
      if (this.autoMode) {
        this.buttons.stretch.color = this.buttons.stretch.offColor;
        this.buttons.stretch.start = false;
      }
    });
  }

  // 初始化eap挂起事件
  initEvent() {
    // 监听浏览器切出事件
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.closeTracking();
        this.closeAI();
        this.closeVideo();
      }
    });

    // app挂起和进入事件声明
    edger.onAction("deactive", () => {
      this.closeTracking();
      this.closeAI();
      this.closeVideo();
    });
  }

  /**
   * 打开或关闭直播
   * @param e
   */
  onPlayer(e?: Event) {
    // 阻止事件传播，禁止事件冒泡
    if (e) {
      e.stopPropagation();
    }
    this.buttons.palyer.start = !this.buttons.palyer.start;
    if (this.buttons.palyer.start) {
      this.buttons.screen.start ? this.np.onResize(90) : this.np.onResize(0);
      this.mediaClient.open(this.cameraService.getPayload());
      this.buttons.palyer.icon = this.buttons.palyer.openIcon;
    } else {
      this.buttons.ai.start = false;
      this.buttons.ai.color = this.buttons.ai.offColor;
      this.mediaClient.clean();
      this.mediaClient.close();
      this.np.stop();
      this.buttons.palyer.icon = this.buttons.palyer.offIcon;
    }
  }

  /**
   * 音频控制
   * @param e 事件
   */
  onAudioChange(e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    this.buttons.audio.start = !this.buttons.audio.start;
    this.buttons.audio.start ? this.np.setVolume(1.0) : this.np.setVolume(0.0);
    this.buttons.audio.icon = this.buttons.audio.start
      ? this.buttons.audio.openIcon
      : this.buttons.audio.offIcon;
  }

  /**
   *  人脸识别控制
   * @param e
   */
  aiControl(e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    if (this.permissionService.isPermissions(['ainn'])) {
      if (this.connected) {
        this.mediaClient.emit(
          "camera-ai",
          !this.buttons.ai.start,
          (client, ret) => {
            if (!ret) {
              this.mediaClient.clean();
            }
            this.buttons.ai.start = ret;
            this.buttons.ai.color = this.buttons.ai.start
              ? this.buttons.ai.openColor
              : this.buttons.ai.offColor;
          }
        );
      }
    }
  }

  /**
   * 屏幕控制
   * @param e 事件对象，用于阻止事件传播
   */
  screenControl(e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    this.mediaClient.clean();
    this.buttons.screen.start = !this.buttons.screen.start;
    if (this.buttons.screen.start) {
      this.buttons.screen.icon = this.buttons.screen.offScreen;
      this.fullScreen();
    } else {
      this.buttons.screen.icon = this.buttons.screen.openScreen;
      this.shrinkScreen();
    }
  }

  /**
   * 全屏
   */
  fullScreen() {
    const height = Math.round(this.clientWidth * (16 / 9));
    this.mediaClient.clean();
    this.mediaClient.setFullScreen(this.clientWidth, height);
    this.show = false;
    this.setVideoSize(this.clientWidth, height);
    this.np.onResize(90);
    setTimeout(() => {
      this.setSideSize();
    }, 100);
  }

  /**
   * 初始化视频大小
   */
  initVideoSize() {
    const height = Math.round(this.clientWidth * (9 / 16));
    this.setVideoSize(this.clientWidth, height);
  }

  /**
   * 设置视频大小
   * @param width
   * @param height
   */
  setVideoSize(width: number, height: number) {
    this.cw.setAttribute("height", height + "px");
    this.cw.style.height = height + "px";
    this.canvas.setAttribute("height", height + "px");
    this.canvas.style.height = height + "px";
    this.video.setAttribute("height", height + "px");
    this.video.style.height = height + "px";
    this.cw.setAttribute("width", width + "px");
    this.cw.style.width = width + "px";
    this.canvas.setAttribute("width", width + "px");
    this.canvas.style.width = width + "px";
    this.video.setAttribute("width", width + "px");
    this.video.style.width = width + "px";
  }

  /**
   * 退出全屏
   */
  shrinkScreen() {
    const height = Math.round(this.clientWidth * (9 / 16));
    this.mediaClient.clean();
    this.mediaClient.setCanvaSize(this.clientWidth, height);
    this.show = true;
    this.setVideoSize(this.clientWidth, height);
    this.np.onResize(0);
    setTimeout(() => {
      this.setStretchColor();
      this.setStretch();
    }, 300);
  }

  // 关闭视频
  closeVideo() {
    this.mediaClient.close();
    this.np.stop();
    this.buttons.palyer.start = false;
    this.buttons.palyer.icon = this.buttons.palyer.offIcon;
  }

  /**
   * 关闭人像追踪
   */
  closeTracking() {
    this.mediaClient.emit("camera-mode", false, (client, ret) => {
      if (!ret.result) {
        edger.notify.error(ret.msg);
      }
      this.autoMode = ret.autoMode;
      this.setTrackingColor();
      if (this.autoMode) {
        this.buttons.stretch.color = this.buttons.stretch.offColor;
        this.buttons.stretch.start = false;
      }
    });
  }

  /**
   * 关闭人脸识别
   */
  closeAI() {
    this.mediaClient.emit("camera-ai", false, (client, ret) => {
      if (!ret) {
        this.mediaClient.clean();
      }
      this.buttons.ai.start = ret;
      this.buttons.ai.color = this.buttons.ai.start
        ? this.buttons.ai.openColor
        : this.buttons.ai.offColor;
    });
  }

  /**
   * 拼接直播地址
   */
  getUrl(): string {
    let wsProtocol = "ws";
    if (location.protocol === "https:") {
      wsProtocol = "wss";
    }
    if (location.port) {
      return `${wsProtocol}://${document.domain}:${window.location.port}`;
    } else {
      return `${wsProtocol}://${document.domain}:80`;
    }
  }

  /**
   * 移动摄像头
   * @param e 事件对象，用于阻止事件传播和移除默认行为
   * @param obj 移动指令
   */
  moveCamera(e: Event, obj: any) {
    if (typeof e.target === "undefined") {
      return;
    }
    e.preventDefault();
    if (!this.lock && this.connected) {
      this.moveData = obj;
      this.lock = true;
      this.sendMoveData(obj);
    }
  }

  sendMoveData(obj: any) {
    this.mediaClient.emit("camera-move", obj, (client, ret) => {
      console.log(ret);
      if (!ret.result) {
        if(this.stateService.getActive()) {
          edger.notify.error(ret.msg);
        }
        return;
      }
      if (this.lock && ret.result) {
        this.moveTimeout = setTimeout(() => {
          this.sendMoveData(obj);
        }, 800);
      } else {
        this.mediaClient.emit("camera-stop", (client, ret) => {
          if (!ret.result && this.stateService.getActive()) {
            edger.notify.error(ret.msg);
          }
        });
      }
    });

  }



  /**
   * 设置跟踪按钮颜色
   */
  setTrackingColor() {
    this.buttons.tracking.color = this.autoMode
      ? this.buttons.tracking.openColor
      : this.buttons.tracking.offColor;
  }

  /**
   * 设置伸缩按钮颜色
   */
  setStretchColor() {
    this.buttons.stretch.color = this.buttons.stretch.start
      ? this.buttons.stretch.openColor
      : this.buttons.stretch.offColor;
  }

  /**
   * 停止摄像头移动
   * @param e
   */
  stopCameraMove(e: Event) {
    this.lock = false;
    clearTimeout(this.moveTimeout);
    this.mediaClient.emit("camera-stop", (client, ret) => {
      if (!ret.result && this.stateService.getActive()) {
        edger.notify.error(ret.msg);
      }
    });
  }

  /**
   * 摄像头恢复到初始位置
   */
  cameraHome() {
    if (this.connected) {
      this.mediaClient.emit("camera-home", (client, ret) => {
        if (!ret.result && this.stateService.getActive()) {
          edger.notify.error(ret.msg);
        }
      });
    }
  }

  /**
   * 是否自动追踪
   * @param e
   */
  updateCameraMode(e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    if (this.connected) {
      this.mediaClient.emit("camera-mode", !this.autoMode, (client, ret) => {
        if (!ret.result && this.stateService.getActive()) {
          edger.notify.error(ret.msg);
        }
        this.autoMode = ret.autoMode;
        this.setTrackingColor();
        if (this.autoMode) {
          this.buttons.stretch.color = this.buttons.stretch.offColor;
          this.buttons.stretch.start = false;
        }
      });
    }
  }

  /**
   * 控制侧边栏伸缩
   * @param e
   */
  sideStretch(e: Event) {
    console.log(e);
    let child = document.getElementById("side");
    const left = child.style.left;
    left === "0px" ? (child.style.left = "-70px") : (child.style.left = "0px");
  }

  /**
   * 设置侧边栏样式大小
   */
  setSideSize() {
    const contentHeight = this.clientHeight - 44;
    let height = this.sideHeight;
    if (height > contentHeight) {
      height = contentHeight;
    }
    document.getElementById("parentSide").setAttribute("height", height + "px");
    document.getElementById("parentSide").style.height = height + "px";
    document.getElementById("side").setAttribute("height", height + "px");
    document.getElementById("side").style.height = height + "px";
    document.getElementById("side").style.display = "grid";
    document.getElementById("side").style.gridRow = "repeat(6, 16.66%)";
  }

  /**
   * 方向盘的伸缩样式
   * @param e
   */
  stretch(e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    this.buttons.stretch.start = !this.buttons.stretch.start;
    this.setStretchColor();
    this.setStretch();
  }

  /**
   * 方向盘的伸缩控制
   */
  setStretch() {
    let child = document.getElementById("child");
    if (child) {
      this.buttons.stretch.start
        ? (child.style.top = "0px")
        : (child.style.top = "-300px");
    }
  }

  /**
   *  更新方向盘伸缩状态
   * @param e
   */
  updateStretchStatus(e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    this.buttons.stretch.start = !this.buttons.stretch.start;
    this.setStretchColor();
  }
}
