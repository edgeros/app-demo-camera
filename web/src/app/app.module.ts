import { NgModule } from '@angular/core';
import { BrowserModule, HammerModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule } from '@angular/common/http';
import { CameraService } from './service/camera.service';
import { AlertService } from './service/alert.service';
import { PermissionService } from './service/permission.service';
import { StateService } from './service/state.service';

@NgModule({
  declarations: [AppComponent],
  entryComponents: [],
  imports: [BrowserModule,  HammerModule, IonicModule.forRoot({
    rippleEffect: false,
    mode: 'ios',
    backButtonIcon: 'chevron-back'
  }), AppRoutingModule, HttpClientModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    CameraService,
    AlertService,
    PermissionService,
    StateService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {} 
