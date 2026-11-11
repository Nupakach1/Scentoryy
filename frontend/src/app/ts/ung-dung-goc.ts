import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Thành phần gốc — mọi bố cục nằm trong tuyen-duong.ts */
@Component({ selector: 'app-goc', standalone: true, imports: [RouterOutlet], template: '<router-outlet />' })
export class UngDungGoc {}
