import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Trang 404 — mọi đường dẫn không khớp tuyến (ERR-SYS-404-01 phía giao diện). */
@Component({ selector: 'app-khong-tim-thay', standalone: true, imports: [RouterLink], templateUrl: '../../html/trang-khach/khong-tim-thay.html' })
export class KhongTimThay {}
