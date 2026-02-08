import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LibraryShowcasePage } from './library-showcase.page';

const routes: Routes = [
  {
    path: '',
    component: LibraryShowcasePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LibraryShowcasePageRoutingModule {}
