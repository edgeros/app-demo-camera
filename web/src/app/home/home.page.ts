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

  constructor(
    private cameraService: CameraService,
    private permissionService: PermissionService
    ) {
      this.cameraService.getCameraMapChange().subscribe((data: Map<string, Camera>) => {
        this.cameraMap = data;
      });
  }

  ngOnInit() {
    setTimeout(() => {
      this.permissionService.updatePermission(()=>{
        this.cameraService.getCameraList();
      });     
    }, 500);
  }

  /**
   * 进入某个设备详情页
   * @param camera 
   */
  getCameraDetailsPage(camera: Camera) {
    this.cameraService.getCameraDetails(camera);

  }

  doRefresh(event) {
    setTimeout(() => {
      this.cameraService.getCameraList();
      event.target.complete();
    }, 1000);
  }

}
