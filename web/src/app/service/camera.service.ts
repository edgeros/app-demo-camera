import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { edger } from '@edgeros/web-sdk';
import {
  NavController
} from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { Camera } from '../model/camera';
import { AlertService } from './alert.service';
import { PermissionService } from './permission.service';
import { StateService } from './state.service';

@Injectable({
  providedIn: 'root',
})
export class CameraService {

  // 包含token和srand
  private payload: any = {
    token: 'token',
    srand: 'srand'
  };

  // 设备列表观察者对象
  cameraMapChange = new BehaviorSubject<Map<string, Camera>>(
    new Map<string, Camera>()
  );

  // 当前设备信息 可观察对象
  thisCameraChange = new BehaviorSubject<Camera>(null);

  // 设备列表
  cameraMap = new Map<string, Camera>();

  // 当前设备
  thisCamera: Camera;

  // 判断当前的列表元素是否被锁定，防止二次点击
  detailsLock = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private nav: NavController,
    private alertService: AlertService,
    private permissionService: PermissionService,
    private activeRoute: ActivatedRoute,
    private stateService: StateService
  ) {
    edger.token().then((data: any) => {
      if (data) {
        this.payload = data;
      } else {
        if(this.stateService.getActive()) {
          edger.notify.warning('请先登录！');
        }
      }
    }).catch((err) => {
      console.error(err);
    });
    edger.onAction('token', (data: any) => {
      console.log(data);
      if (data) {
        this.payload = data;
      } else {
        if(this.stateService.getActive()) {
          edger.notify.warning('请先登录！');
        }
      }

    });
    setTimeout(() => this.timerGetCameraList(), 500);
  }

  /**
   * 定时查询设备列表
   */
  timerGetCameraList() {
    setInterval(() => this.getCameraList(), 5000);
  }

  /**
   * 查询设备列表
   */
  getCameraList() {
    let permission = this.permissionService.isPermissions(['network']);
    if (permission) {
      this.http
        .get('/api/list', { headers: this.getHttpHeaders() })
        .subscribe((cameras: Camera[]) => {
          if (cameras.length === 0) {
            if(this.stateService.getActive()) {
              edger.notify.info(`暂无设备！`);
            }
          }
          this.cameraMap.clear();
          cameras.forEach((value) => {
            this.cameraMap.set(value.devId, value);
          });
          this.cameraMapChange.next(this.cameraMap);
          if (this.thisCamera) {
            if (this.cameraMap.has(this.thisCamera.devId)) {
              if (this.cameraMap.get(this.thisCamera.devId).status) {
                this.thisCamera = this.cameraMap.get(this.thisCamera.devId);
              } else {
                this.lostAlertConfirm(
                  `当前设备：${this.thisCamera.alias} 已下线！`
                );
                this.thisCamera = null;
              }
            } else {
              this.lostAlertConfirm(
                `当前设备：${this.thisCamera.alias} 已下线！`
              );
              this.thisCamera = null;
            }
          }
        });
    }
  }


  /**
   * 打开某个摄像头
   * @param camera 
   */
  getCameraDetails(camera: Camera) {
    if (this.permissionService.isPermissions(['rtsp'])) {
      if (this.detailsLock) {
        return;
      }
      this.detailsLock = true;
      this.http
        .get('/api/select/' + '?devId=' + camera.devId, {
          headers: this.getHttpHeaders(),
        })
        .subscribe(
          (res: any) => {
            if (res.result) {
              if (res.login) {
                this.detailsLock = false;
                this.loginDevicePresentAlertPrompt(camera);
              } else {
                camera.videoUrl = res.videoUrl;
                camera.enableMove = res.enableMove;
                camera.autoMode = res.autoMode;
                this.thisCamera = camera;
                this.router.navigate(['/details', camera]);
                this.detailsLock = false;
              }
            } else {
              this.detailsLock = false;
              if(this.stateService.getActive()) {
                if (res.code === 50001) {
                  edger.notify.error(`流媒体启动失败，请检查权限！`);
                } else if (res.code === 50002) {
                  edger.notify.error(`无效设备！`);
                } else if (res.code === 40307) {
                  edger.notify.error(`缺少 "视频流" 权限！`);
                } else {
                  edger.notify.error(`未知错误！`);
                }
              }
            }

          },
          (error) => {
            console.log(error);
            this.detailsLock = false;
            edger.notify.error(error.error);
          }
        );
    }
  }

  // 获取设备列表可观察对象
  getCameraMapChange() {
    return this.cameraMapChange;
  }

  // 获取当前设备可观察对象
  getThisCameraChange() {
    return this.thisCameraChange;
  }

  /**
   * 设备掉线提示框
   * @param msg 
   */
  async lostAlertConfirm(msg: string) {
    this.alertService.lostAlertConfirm(msg, () => {
      console.log(this.router.url);
      if (!this.router.url.includes('home')) {
        this.nav.back();
      }
    })
  }

  /**
   * 登录设备
   * @param loginInfo 
   * @param camera 
   */
  loginDevice(loginInfo: any, camera: Camera) {
    this.http.post('/api/login', loginInfo, { headers: this.getHttpHeaders() }).subscribe((res: any) => {
      console.log(res);
      if (res.result) {
        camera.videoUrl = res.videoUrl;
        camera.enableMove = res.enableMove;
        camera.autoMode = res.autoMode;
        this.thisCamera = camera;
        this.router.navigate(['/details', camera]);
      } else {
        this.detailsLock = false;
        if(this.stateService.getActive()) {
          if (res.code === 50001) {
            edger.notify.error(`流媒体启动失败，请检查权限！`);
          } else if (res.code === 50002) {
            edger.notify.error(`无效设备！`);
          } else if (res.code === 50003) {
            edger.notify.error(`登录设备失败！`);
          }
        }
      }
    }, (err) => {
      console.error(err);
      this.detailsLock = false;
    });
  }

  /**
   * 登录框
   * @param camera 
   */
  async loginDevicePresentAlertPrompt(camera: Camera) {
    this.alertService.loginDevicePresentAlertPrompt(camera, (loginInfo) => {
      this.detailsLock = true;
      this.loginDevice(loginInfo, camera);
    });
  }

  getPayload(): any {
    return this.payload;
  }

  getHttpHeaders() {
    return new HttpHeaders().set('edger-token', this.payload.token).
      set('edger-srand', this.payload.srand);
  }
}
