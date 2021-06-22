import { Injectable } from '@angular/core';
import { edger, EdgerReqPermsParams } from '@edgeros/web-sdk';
import { AlertService } from './alert.service';
import { StateService } from './state.service';
@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  permissionTable = new Map<string, string>([
    ['ainn', 'AI'],
    ['network', '基本网络'],
    ['rtsp', '视频流']
  ]);

  permissions = {};

  codes = ['network', 'ainn', 'rtsp'];

  constructor(private alertService: AlertService, private stateService: StateService) {
    edger.permission.fetch().then((data) => {
      this.permissions = data;
      this.requestAccess();

    }).catch((err) => {
      if(this.stateService.getActive()) {
        edger.notify.error(`权限获取错误！`);
      }
    });
    edger.onAction('permission', (data) => {
      this.permissions = data;
    });
  }

  requestAccess() {
    const permissions = this.getUnauthorizedPermission();
    this.requestAuthorization(permissions);
  }

  /**
   * 向 edgeros 申请权限 
   */

  checkPermission(permission: string): boolean {
    if (permission.indexOf('.') !== -1) {
      let code = permission.split('.');
      return this.permissions[code[0]][code[1]]
    }
    return this.permissions[permission];
  }

  permissionToName(permissions: string[]) {
    return permissions.map((permission) => {
      return this.permissionTable.get(permission);
    });
  }


  isPermissions(permissions: string[]): boolean {
    let code = [];
    permissions.forEach((permission) => {
      if (!this.checkPermission(permission)) {
        code.push(permission);
      }
    });
    if (code.length !== 0) {
      const names = this.permissionToName(code);
      this.alertService.openAppAlertConfirm(`您没有 ${names.toString()} 权限,是否打开设置开启应用权限？`, () => {
        edger.app.open({ id: 'com.acoinfo.setting'}, {
          type: 'permissions',
          msg: {
          }
        })
      });
      return false;
    }
    return true;
  }

  getUnauthorizedPermission(): string[] {
    return this.codes.filter((value) => {
      return !this.checkPermission(value);
    });
  }

  updatePermission(callback: () => void) {
    edger.permission.fetch().then((data) => {
      this.permissions = data;
      callback();
    }).catch((err) => {
      if(this.stateService.getActive()) {
        edger.notify.error(`更新权限错误！`);
      }
    });
  }

  requestAuthorization(permissions: string[]) {
    if (permissions.length !== 0) {
      const config: EdgerReqPermsParams = {
        code: permissions,
        type: 'permissions'
      };

      edger.permission.request(config).then((data) => {
        console.log(`permissionRequest:${JSON.stringify(data)}`);
      });
    }
  }

}
