import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendMailComponent } from './send-mail.component';

describe('SendMailComponent', () => {
  let component: SendMailComponent;
  let fixture: ComponentFixture<SendMailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendMailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SendMailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
