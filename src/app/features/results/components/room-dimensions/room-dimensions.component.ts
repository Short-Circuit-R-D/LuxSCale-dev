import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-room-dimensions',
  imports: [DecimalPipe],
  templateUrl: './room-dimensions.component.html',
  styleUrl: './room-dimensions.component.css',
})
export class RoomDimensionsComponent {
  width = input.required<number>();
  length = input.required<number>();
  ceilingHeight = input.required<number>();
}
