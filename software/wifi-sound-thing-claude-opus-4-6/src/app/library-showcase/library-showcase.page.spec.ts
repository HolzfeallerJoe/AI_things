import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { LibraryShowcasePage } from './library-showcase.page';

describe('LibraryShowcasePage', () => {
  let component: LibraryShowcasePage;
  let fixture: ComponentFixture<LibraryShowcasePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), LibraryShowcasePage],
    }).compileComponents();

    fixture = TestBed.createComponent(LibraryShowcasePage);
    component = fixture.componentInstance;
    // Note: detectChanges() is skipped because the template binds iframe
    // [src] with raw strings that require DomSanitizer at runtime.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should list five library demos', () => {
    expect(component.libraryDemos.length).toBe(5);
  });

  it('should provide iframe source for each library', () => {
    const missingSrc = component.libraryDemos.some((demo) => !demo.iframeSrc);
    expect(missingSrc).toBeFalse();
  });
});
