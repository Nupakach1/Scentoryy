// Điểm khởi chạy ứng dụng Angular SCENTORY
import { bootstrapApplication } from '@angular/platform-browser';
import { cauHinhUngDung } from './app/ts/cau-hinh-ung-dung';
import { UngDungGoc } from './app/ts/ung-dung-goc';

bootstrapApplication(UngDungGoc, cauHinhUngDung).catch((loi) => console.error(loi));
