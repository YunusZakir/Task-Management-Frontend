import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './accept-invite.component.html',
  styleUrl: './accept-invite.component.scss'
})
export class AcceptInviteComponent {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  name = '';
  password = '';
  submit() {
    const token = this.route.snapshot.queryParamMap.get('token') || '';
    this.auth.acceptInvite(token, this.name, this.password);
  }
}
