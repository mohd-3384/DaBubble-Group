import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChannelsComponent } from '../../../channels/channels.component';
import { HeaderComponent } from "../../header/header.component";

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, ChannelsComponent, HeaderComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent { }
