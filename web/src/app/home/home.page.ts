import { Component } from '@angular/core';
import { Camera } from '../model/camera';
import { CameraService } from '../service/camera.service';
import { PermissionService } from '../service/permission.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  // 设备列表
  cameraMap = new Map<string, Camera>();
  showMap = new Map<string, boolean>();

  constructor(
    private cameraService: CameraService,
    private permissionService: PermissionService
  ) {
    this.cameraService.getCameraMapChange().subscribe((data: Map<string, Camera>) => {
      this.cameraMap = data;
      this.showMap.forEach((value, key) => {
        if(!this.cameraMap.has(key)) {
          this.showMap.delete(key);
        }
      });
      this.cameraMap.forEach((value, key) => {
        if(!this.showMap.has(key)) {
          this.showMap.set(key, false);
        }
      });
    });
  }

  ngOnInit() {
    setTimeout(() => {
      this.permissionService.updatePermission(() => {
        this.cameraService.getCameraList(2);
      });
    }, 500);
  }

  /**
   * 进入某个设备详情页
   * @param camera 
   */
  getCameraDetailsPage(camera: Camera, stream: any) {
    this.cameraService.getCameraDetails(camera, stream);
  }

  async openDevice(devId: string) {
    await this.cameraService.openDevice(devId);
    this.showMap.set(devId, !this.showMap.get(devId));
  }

  doRefresh(event) {
    setTimeout(() => {
      this.cameraService.getCameraList(2);
      event.target.complete();
    }, 1000);
  }

}
