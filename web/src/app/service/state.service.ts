import { Injectable } from '@angular/core';
import { edger } from '@edgeros/web-sdk';

@Injectable({
  providedIn: 'root'
})
export class StateService {

  private active = false;

  constructor() { 
    edger.onAction('active', () => {
      this.active = true;
    });
    edger.onAction('deactive', () => {
      this.active = false;
    });
  }


  getActive() {
    return this.active;
  }
}
