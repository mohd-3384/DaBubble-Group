import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChoseAvatarComponent } from './chose-avatar.component';

describe('ChoseAvatarComponent', () => {
  let component: ChoseAvatarComponent;
  let fixture: ComponentFixture<ChoseAvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChoseAvatarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChoseAvatarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
