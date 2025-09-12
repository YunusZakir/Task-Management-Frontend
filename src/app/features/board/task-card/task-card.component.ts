import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskDto } from '../../../core/api.service';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss'
})
export class TaskCardComponent {
  @Input() task!: TaskDto;
}
