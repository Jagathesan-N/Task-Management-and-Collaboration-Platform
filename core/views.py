from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from collections import defaultdict
from django.contrib import messages

from django.core.mail import send_mail
from django.contrib.auth.views import LoginView
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required

from pytz import timezone
from datetime import timedelta
from django.utils import timezone as dj_timezone
from django.db.models import Q

from .models import Project, Invite, Notification, ChatMessage, GroupChat, GroupMessage, ProjectDocument, ProjectComment
from .forms import ProjectForm, LoginForm


# ==========================
# 1. HELPERS
# ==========================

PRIORITY_ORDER = {'high': 0, 'medium': 1, 'low': 2}

def sort_by_priority(queryset):
    return sorted(queryset, key=lambda p: (PRIORITY_ORDER.get(p.priority, 1), -p.created_at.timestamp()))

def get_current_member(request):
    return request.user if request.user.is_authenticated else None

def is_admin(request):
    return request.user.is_authenticated and request.user.is_staff

def create_notification(recipient, message):
    if recipient:
        Notification.objects.create(
            user=recipient,
            message=message,
        )

def get_common_context(request):
    cutoff = dj_timezone.now() - timedelta(days=30)

    projects = Project.objects.exclude(
        status='completed',
        completed_at__lt=cutoff
    )

    if not is_admin(request) and request.user.is_authenticated:
        projects = projects.filter(members=request.user)

    return {
        'projects': sort_by_priority(projects),
        'is_admin': is_admin(request),
    }


# ==========================
# 2. AUTH
# ==========================

class CustomLoginView(LoginView):
    template_name = 'login.html'
    authentication_form = LoginForm


# ==========================
# 3. HOME / DASHBOARD
# ==========================

@login_required
def home(request):
    current = request.user

    cutoff = dj_timezone.now() - timedelta(days=30)

    if is_admin(request):
        user_projects = Project.objects.exclude(
            status='completed',
            completed_at__lt=cutoff
        )
    else:
        user_projects = Project.objects.filter(
            members=request.user
        ).exclude(
            status='completed',
            completed_at__lt=cutoff
        )

    total_projects = user_projects.count()
    completed_projects = user_projects.filter(status='completed').count()
    yet_to_start_projects = user_projects.filter(status='yet_to_start').count()
    in_progress_projects = user_projects.filter(status='on_hold').count()
    in_review_projects = user_projects.filter(status='in_review').count()

    completion_rate = round((completed_projects / total_projects * 100)) if total_projects > 0 else 0

    context = {
        'current_member': current,
        'total_projects': total_projects,
        'yet_to_start_projects': yet_to_start_projects,
        'in_progress_projects': in_progress_projects,
        'in_review_projects': in_review_projects,
        'active_projects': in_progress_projects + in_review_projects,
        'on_hold_projects': in_progress_projects,
        'completed_projects': completed_projects,
        'completion_rate': completion_rate,
    }

    context.update(get_common_context(request))
    return render(request, 'home.html', context)


# ==========================
# 4. PROJECTS
# ==========================

@login_required
def project_create(request):
    """Create project — admin only."""
    if not is_admin(request):
        return HttpResponseForbidden("You don't have permission to create projects.")

    if request.method == 'POST':
        form = ProjectForm(request.POST, request.FILES)
        if form.is_valid():
            project = form.save(commit=False)
            project.save()
            form.save_m2m()

            for f in request.FILES.getlist('documents'):
                ProjectDocument.objects.create(project=project, file=f)

            for user in project.members.all():
                Notification.objects.create(
                    user=user,
                    message=f"You have been added to project: {project.name}"
                )
            return redirect('kanban_board', pk=project.pk)
    else:
        form = ProjectForm()

    return render(request, 'project_form.html', {
        'form': form,
        **get_common_context(request)
    })


@login_required
def project_edit(request, pk):
    """Edit project — admin only."""
    if not is_admin(request):
        return HttpResponseForbidden("You don't have permission to edit projects.")

    project = get_object_or_404(Project, pk=pk)
    form = ProjectForm(request.POST or None, request.FILES or None, instance=project)

    if request.method == 'POST' and form.is_valid():
        old_members = set(project.members.all())

        project = form.save(commit=False)
        project.save()
        form.save_m2m()

        for f in request.FILES.getlist('documents'):
            ProjectDocument.objects.create(project=project, file=f)

        new_members = set(project.members.all())

        for user in new_members - old_members:
            Notification.objects.create(
                user=user,
                message=f"📌 You have been added to project: {project.name}"
            )

        for user in old_members - new_members:
            Notification.objects.create(
                user=user,
                message=f"🚫 You have been removed from project: {project.name}"
            )

        for user in new_members & old_members:
            Notification.objects.create(
                user=user,
                message=f"✏️ Project updated: {project.name}"
            )

        return redirect('home')

    return render(request, 'project_form.html', {
        'form': form,
        'project': project,
        **get_common_context(request)
    })


@login_required
def project_delete(request, pk):
    """Delete project — admin only."""
    if not is_admin(request):
        return HttpResponseForbidden("You don't have permission to delete projects.")

    project = get_object_or_404(Project, pk=pk)
    if request.method == 'POST':
        project.delete()
    return redirect('home')


@login_required
def update_project_status(request, project_id):
    """Drag & drop project status update."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid method'}, status=400)

    project = get_object_or_404(Project, pk=project_id)
    new_status = request.POST.get('status', '').strip()

    allowed_statuses = ['yet_to_start', 'on_hold', 'in_review', 'completed']

    if new_status not in allowed_statuses:
        return JsonResponse({'success': False, 'error': 'Invalid status'}, status=400)

    project.status = new_status

    if new_status == 'completed':
        project.completed_at = dj_timezone.now()
    else:
        project.completed_at = None

    project.save()

    return JsonResponse({'success': True})


@login_required
def assign_project_member(request, project_id):
    """Assign/remove members to a project — admin only. Notifies added and removed users."""
    if not is_admin(request):
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'success': False}, status=400)

    project = get_object_or_404(Project, pk=project_id)

    # Get the full intended member list from frontend
    member_ids = request.POST.getlist('member_ids')
    member_ids = [int(mid) for mid in member_ids if mid.strip()]

    # Who is currently assigned (before change)
    existing_ids = set(project.members.values_list('id', flat=True))
    new_ids      = set(member_ids)

    added_ids   = new_ids - existing_ids      # newly added
    removed_ids = existing_ids - new_ids      # just removed

    # Apply the change
    project.members.set(member_ids)

    # Notify newly ADDED members
    for uid in added_ids:
        member = User.objects.get(pk=uid)
        Notification.objects.create(
            user=member,
            message=f"📌 You have been assigned to the project : {project.name}"
        )

    # Notify REMOVED members
    for uid in removed_ids:
        member = User.objects.get(pk=uid)
        Notification.objects.create(
            user=member,
            message=f"🚫 You have been removed from the project : {project.name}"
        )

    return JsonResponse({'success': True})


# ==========================
# 5. KANBAN BOARD
# ==========================

@login_required
def kanban_board(request, pk):
    project = get_object_or_404(Project, pk=pk)

    if not is_admin(request) and request.user not in project.members.all():
        return HttpResponseForbidden("You don't have permission")

    return render(request, 'kanban.html', {
        'project': project,
        'current_member': request.user,
        'all_users': User.objects.all(),
        **get_common_context(request)
    })


# ==========================
# 6. INVITES
# ==========================

@login_required
def send_invite(request, project_id):
    """
    Handles two AJAX actions — always returns JSON:
      action=create  → create the Django user, return success/error JSON
      action=invite  → send invite email, return success/error JSON
    """
    if not is_admin(request):
        return JsonResponse({'success': False, 'message': 'Permission denied.'}, status=403)

    if request.method != "POST":
        return JsonResponse({'success': False, 'message': 'Invalid method.'}, status=405)

    email    = request.POST.get("email", "").strip()
    username = request.POST.get("username", "").strip()
    password = request.POST.get("password", "").strip()
    action   = request.POST.get("action", "").strip()

    # ── ACTION: CREATE USER ──────────────────────────────────────────
    if action == "create":
        if not username or not password:
            return JsonResponse({'success': False, 'message': 'Username and password are required.'})

        if User.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'message': f"Username '{username}' already exists."})

        User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )
        return JsonResponse({'success': True, 'message': f"User '{username}' created successfully!"})

    # ── ACTION: SEND INVITE EMAIL ────────────────────────────────────
    elif action == "invite":
        if not email:
            return JsonResponse({'success': False, 'message': 'Email address is required.'})

        if not User.objects.filter(username=username).exists():
            return JsonResponse({
                'success': False,
                'message': f"User '{username}' not found. Please create the user first."
            })

        project = Project.objects.filter(id=project_id).first()
        project_name = project.name if project else "TaskFlow"
        invite_link = request.build_absolute_uri('/login/')

        if project:
            invite = Invite.objects.create(email=email, project=project)
            invite_link = request.build_absolute_uri(f"/accept-invite/{invite.token}/")

        try:
            send_mail(
                subject="Invitation to Join Content Management System",
                message=(
                    f"Hi,\n\n"
                    f"You have been invited to join the Content Management System at Yuvasoft Technologies Pvt. Ltd.\n\n"
                    f"Your login credentials:\n"
                    f"Username: {username}\n"
                    f"Password: {password}\n\n"
                    f"Please use the link below to activate your account:\n"
                    f"{invite_link}\n\n"
                    f"After activation, you can log in. Projects will be visible once assigned by the administrator.\n\n"
                    f"Regards,\n"
                    f"Yuvasoft Technologies Pvt. Ltd."
                ),
                from_email="your_email@gmail.com",
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            return JsonResponse({'success': False, 'message': f"Failed to send email: {str(e)}"})

        return JsonResponse({'success': True, 'message': f"Invite sent successfully to {email}!"})

    return JsonResponse({'success': False, 'message': 'Unknown action.'})


def accept_invite(request, token):
    """
    When the invited user clicks the invite link:
      1. Mark the invite as accepted.
      2. If the user is already logged in, redirect to home.
      3. Otherwise redirect to login (with next= so they come back here after login).
    After login Django's next= will bring them to home via the login redirect.
    We do NOT add the user to any project here — that is the admin's job.
    """
    invite = get_object_or_404(Invite, token=token)

    # Already accepted — just go to login/home
    if invite.accepted:
        if request.user.is_authenticated:
            return redirect('home')
        return redirect('login')

    # Mark invite as accepted
    invite.accepted = True
    invite.save()

    # If not logged in, send to login page
    if not request.user.is_authenticated:
        return redirect(f'/login/?next=/')

    # Already logged in — go straight to home
    return redirect('home')


# ==========================
# 7. CALENDAR
# ==========================

@login_required
def calendar_view(request):
    current = request.user
    calendar_data = defaultdict(list)

    if is_admin(request):
        projects = Project.objects.exclude(status='completed')
    else:
        projects = Project.objects.filter(members=current).exclude(status='completed')

    for project in projects:
        if project.due_date:
            calendar_data[project.due_date].append({
                'title': project.name,
                'priority': project.priority,
                'type': 'project'
            })

    return render(request, 'calendar.html', {
        'calendar_data': dict(calendar_data),
        'current_member': current,
        **get_common_context(request)
    })


# ==========================
# 8. NOTIFICATIONS & INBOX
# ==========================

@login_required
def inbox(request):
    current = request.user

    notifications = Notification.objects.filter(
        user=current,
        is_read=False
    ).order_by('-created_at')[:30]

    return render(request, 'inbox.html', {
        'notifications': notifications,
        'current_member': current,
        **get_common_context(request)
    })


def get_unread_notifications(request):
    """Polled every 5s by inbox.html + base.html."""
    if not request.user.is_authenticated:
        return JsonResponse({'notifications': []})

    notifications = Notification.objects.filter(
        user=request.user,
        is_read=False
    ).order_by('-created_at')[:5]

    data = [
        {
            'id': n.id,
            'message': n.message,
            'created_at': n.created_at.astimezone(timezone('Asia/Kolkata')).strftime('%b %d, %I:%M %p')
        }
        for n in notifications
    ]
    return JsonResponse({'notifications': data})


@login_required
def mark_notification_read(request, notification_id):
    if request.method == 'POST':
        notification = get_object_or_404(Notification, pk=notification_id, user=request.user)
        notification.is_read = True
        notification.save()
        return JsonResponse({'success': True})
    return JsonResponse({'success': False}, status=400)


# ==========================
# 9. DIRECT CHAT
# ==========================

@login_required
def chat_view(request):
    users = User.objects.exclude(id=request.user.id)

    if is_admin(request):
        messages = ChatMessage.objects.all().order_by('created_at')
    else:
        messages = ChatMessage.objects.filter(
            Q(recipient=None) |
            Q(recipient=request.user) |
            Q(sender=request.user)
        ).order_by('created_at')

    # Groups the current user belongs to
    my_groups = GroupChat.objects.filter(members=request.user).order_by('-created_at')

    # Use permission assigned to Manoj
    can_create_group = request.user.has_perm('core.add_groupchat')

    return render(request, 'chat.html', {
        'users': users,
        'messages': messages,
        'current_user': request.user,
        'my_groups': my_groups,
        'can_create_group': can_create_group,
        **get_common_context(request)
    })


@login_required
def send_message(request):
    if request.method == 'POST':
        text = request.POST.get('message', '').strip()
        recipient_id = request.POST.get('recipient_id')

        if text:
            recipient = None
            if recipient_id:
                recipient = get_object_or_404(User, pk=recipient_id)

            ChatMessage.objects.create(
                sender=request.user,
                recipient=recipient,
                message=text
            )

            sender_name = request.user.get_full_name() or request.user.username
            preview = text[:60] + ('...' if len(text) > 60 else '')

            if recipient:
                Notification.objects.create(
                    user=recipient,
                    message=f"💬 {sender_name} sent you a message: {preview}"
                )
            else:
                for user in User.objects.exclude(id=request.user.id):
                    Notification.objects.create(
                        user=user,
                        message=f"💬 {sender_name} sent a message to Everyone: {preview}"
                    )

        return JsonResponse({'success': True})
    return JsonResponse({'success': False}, status=400)


@login_required
def get_messages(request):
    recipient_id = request.GET.get('recipient')

    if recipient_id:
        messages = ChatMessage.objects.filter(
            Q(sender=request.user, recipient_id=recipient_id) |
            Q(sender_id=recipient_id, recipient=request.user)
        ).exclude(hidden_for=request.user).order_by('created_at')
    else:
        messages = ChatMessage.objects.filter(
            recipient=None
        ).exclude(hidden_for=request.user).order_by('created_at')

    data = [
        {
            'id': m.id,
            'sender': m.sender.get_full_name() or m.sender.username,
            'sender_id': m.sender.id,
            'recipient': m.recipient.get_full_name() or m.recipient.username if m.recipient else 'Everyone',
            'message': m.message,
            'created_at': m.created_at.astimezone(timezone('Asia/Kolkata')).strftime('%b %d, %I:%M %p'),
            'is_mine': m.sender.id == request.user.id,
            'is_deleted': m.is_deleted,
        }
        for m in messages
    ]
    return JsonResponse({'messages': data})


@login_required
def get_unread_counts(request):
    """Returns unread message count per sender for the current user."""
    direct_unread = ChatMessage.objects.filter(
        recipient=request.user,
        is_deleted=False,
        is_read=False,
    ).exclude(sender=request.user).exclude(hidden_for=request.user)

    counts = {}
    for msg in direct_unread:
        sid = str(msg.sender.id)
        counts[sid] = counts.get(sid, 0) + 1

    broadcast_unread = ChatMessage.objects.filter(
        recipient=None,
        is_deleted=False,
        is_read=False,
    ).exclude(sender=request.user).exclude(hidden_for=request.user).count()

    counts['broadcast'] = broadcast_unread

    # Unread group message counts
    my_groups = GroupChat.objects.filter(members=request.user)
    for group in my_groups:
        unread = GroupMessage.objects.filter(
            group=group,
            is_deleted=False,
        ).exclude(sender=request.user).exclude(hidden_for=request.user).exclude(is_read_by=request.user).count()
        if unread > 0:
            counts[f'group_{group.id}'] = unread

    return JsonResponse({'counts': counts})


@login_required
def mark_conversation_read(request):
    """Mark all messages in a conversation as read."""
    if request.method == 'POST':
        sender_id = request.POST.get('sender_id')

        if sender_id:
            ChatMessage.objects.filter(
                sender_id=sender_id,
                recipient=request.user,
                is_read=False,
            ).update(is_read=True)
        else:
            ChatMessage.objects.filter(
                recipient=None,
                is_read=False,
            ).exclude(sender=request.user).update(is_read=True)

        return JsonResponse({'success': True})
    return JsonResponse({'success': False}, status=400)


@login_required
def delete_message(request, message_id):
    """Delete message for everyone only within 1 hour."""
    if request.method == 'POST':
        msg = get_object_or_404(ChatMessage, pk=message_id)

        if msg.sender == request.user or is_admin(request):

            # Admin can delete anytime
            if not is_admin(request):
                if dj_timezone.now() > msg.created_at + timedelta(hours=1):
                    return JsonResponse({
                        'success': False,
                        'error': 'Delete for everyone available only for 1 hour.'
                    }, status=403)
            msg.is_deleted = True
            msg.message = "This message was deleted"
            msg.save()

            return JsonResponse({'success': True})

    return JsonResponse({'success': False}, status=403)


@login_required
def delete_message_for_me(request, message_id):
    """Delete message for current user only."""
    if request.method == 'POST':
        msg = get_object_or_404(ChatMessage, pk=message_id)
        msg.hidden_for.add(request.user)
        return JsonResponse({'success': True})
    return JsonResponse({'success': False}, status=403)


@login_required
def clear_all_chat(request):
    """Clear all messages in a conversation — admin only."""
    if not is_admin(request):
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

    if request.method == 'POST':
        recipient_id = request.POST.get('recipient_id')

        if recipient_id:
            messages_qs = ChatMessage.objects.filter(
                Q(sender=request.user, recipient_id=recipient_id) |
                Q(sender_id=recipient_id, recipient=request.user)
            )
        else:
            messages_qs = ChatMessage.objects.filter(recipient=None)

        for msg in messages_qs:
            msg.hidden_for.add(request.user)

        return JsonResponse({'success': True})

    return JsonResponse({'success': False}, status=400)


# ==========================
# 10. GROUP CHAT
# ==========================

@login_required
def create_group_chat(request):
    """
    POST  → create group, redirect to group chat view
    GET   → return list of users as JSON (for member picker UI)
    """
    if not request.user.has_perm('core.add_groupchat'):
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

    if request.method == 'POST':
        import json
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, AttributeError):
            body = request.POST

        name = (body.get('name') or '').strip()
        member_ids = body.get('member_ids', [])

        if not name:
            return JsonResponse({'success': False, 'error': 'Group name is required.'}, status=400)

        if not member_ids:
            return JsonResponse({'success': False, 'error': 'Select at least one member.'}, status=400)

        group = GroupChat.objects.create(name=name, created_by=request.user)
        group.members.add(request.user)  # creator is always a member

        for mid in member_ids:
            try:
                user = User.objects.get(pk=int(mid))
                group.members.add(user)
            except (User.DoesNotExist, ValueError):
                pass

        # Notify added members
        creator_name = request.user.get_full_name() or request.user.username
        for member in group.members.exclude(id=request.user.id):
            Notification.objects.create(
                user=member,
                message=f"👥 {creator_name} added you to group \"{group.name}\""
            )

        return JsonResponse({'success': True, 'group_id': group.id, 'group_name': group.name})

    # GET – return pickable users list
    users = User.objects.exclude(id=request.user.id).values('id', 'username', 'first_name', 'last_name')
    user_list = [
        {
            'id': u['id'],
            'display': f"{u['first_name']} {u['last_name']}".strip() or u['username'],
        }
        for u in users
    ]
    return JsonResponse({'users': user_list})


@login_required
def group_chat_view(request, group_id):
    """Render the group chat page."""
    group = get_object_or_404(GroupChat, pk=group_id)

    if request.user not in group.members.all():
        return HttpResponseForbidden("You are not a member of this group.")

    my_groups = GroupChat.objects.filter(members=request.user).order_by('-created_at')
    users = User.objects.exclude(id=request.user.id)

    can_create_group = request.user.has_perm('core.add_groupchat')

    return render(request, 'chat.html', {
        'users': users,
        'current_user': request.user,
        'my_groups': my_groups,
        'active_group': group,
        'can_create_group': can_create_group,
        'is_admin': request.user.is_staff,
        **get_common_context(request)
    })


@login_required
def send_group_message(request, group_id):
    """Send a message to a group."""
    if request.method != 'POST':
        return JsonResponse({'success': False}, status=400)

    group = get_object_or_404(GroupChat, pk=group_id)

    if request.user not in group.members.all():
        return JsonResponse({'success': False, 'error': 'Not a member'}, status=403)

    text = request.POST.get('message', '').strip()
    if not text:
        return JsonResponse({'success': False, 'error': 'Empty message'}, status=400)

    msg = GroupMessage.objects.create(group=group, sender=request.user, message=text)
    msg.is_read_by.add(request.user)

    sender_name = request.user.get_full_name() or request.user.username
    preview = text[:60] + ('...' if len(text) > 60 else '')

    for member in group.members.exclude(id=request.user.id):
        Notification.objects.create(
            user=member,
            message=f"👥 {sender_name} in \"{group.name}\": {preview}"
        )

    return JsonResponse({'success': True})


@login_required
def get_group_messages(request, group_id):
    """Poll for messages in a group."""
    group = get_object_or_404(GroupChat, pk=group_id)

    if request.user not in group.members.all():
        return JsonResponse({'messages': [], 'error': 'Not a member'}, status=403)

    messages = GroupMessage.objects.filter(group=group)\
        .exclude(hidden_for=request.user)\
        .order_by('created_at')

    for msg in messages.exclude(is_read_by=request.user):
        msg.is_read_by.add(request.user)

    data = [
        {
            'id':         m.id,
            'sender':     m.sender.get_full_name() or m.sender.username,
            'sender_id':  m.sender.id,
            'message':    m.message,
            'created_at': m.created_at.astimezone(timezone('Asia/Kolkata')).strftime('%b %d, %I:%M %p'),
            'is_mine':    m.sender.id == request.user.id,
            'is_deleted': m.is_deleted,
        }
        for m in messages
    ]
    return JsonResponse({'messages': data, 'group_name': group.name})


@login_required
def get_group_members(request, group_id):
    group = get_object_or_404(GroupChat, id=group_id, members=request.user)
    members = []
    for m in group.members.all():
        members.append({
            'id': m.id,
            'display': m.get_full_name() or m.username,
            'username': m.username,
            'is_creator': m.id == group.created_by_id,
        })
    return JsonResponse({'members': members})


@login_required
def delete_group_message(request, message_id):
    """Delete group message for everyone only within 1 hour."""
    if request.method == 'POST':
        msg = get_object_or_404(GroupMessage, pk=message_id)

        if msg.sender == request.user or is_admin(request):

            # Admin can delete anytime
            if not is_admin(request):
                if dj_timezone.now() > msg.created_at + timedelta(hours=1):
                    return JsonResponse({
                        'success': False,
                        'error': 'Delete for everyone available only for 1 hour.'
                    }, status=403)
            msg.is_deleted = True
            msg.message = "This message was deleted"
            msg.save()

            return JsonResponse({'success': True})

        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)

    return JsonResponse({'success': False}, status=400)


@login_required
def delete_group_message_for_me(request, message_id):
    """Hide a group message for the current user only."""
    if request.method == 'POST':
        msg = get_object_or_404(GroupMessage, pk=message_id)
        if request.user in msg.group.members.all():
            msg.hidden_for.add(request.user)
            return JsonResponse({'success': True})
        return JsonResponse({'success': False, 'error': 'Not a member'}, status=403)
    return JsonResponse({'success': False}, status=400)


@login_required
def leave_group(request, group_id):
    """Current user leaves a group — for regular users."""
    if request.method == 'POST':
        group = get_object_or_404(GroupChat, pk=group_id)
        group.members.remove(request.user)
        if group.members.count() == 0:
            group.delete()
        return JsonResponse({'success': True})
    return JsonResponse({'success': False}, status=400)


@login_required
def delete_group(request, group_id):
    """Delete a group entirely — Admin OR Team Leader (Manoj) can delete."""
    if request.method == 'POST':
        # Allow both Admin and Manoj (Team Leader)
        if not (request.user.is_staff or request.user.username.lower() == 'manoj'):
            return JsonResponse({'success': False, 'error': 'Permission denied. Only admin or team leader can delete groups.'}, status=403)

        group = get_object_or_404(GroupChat, pk=group_id)
        group_name = group.name

        # Notify all members before deletion
        for member in group.members.exclude(id=request.user.id):
            Notification.objects.create(
                user=member,
                message=f"🗑️ The group \"{group_name}\" was deleted by {request.user.get_full_name() or request.user.username}."
            )

        group.delete()
        return JsonResponse({'success': True})

    return JsonResponse({'success': False}, status=400)


# ==========================
# 11. PROJECT COMMENTS
# ==========================

@login_required
def get_project_comments(request, project_id):
    from pytz import timezone as tz
    comments = ProjectComment.objects.filter(
        project_id=project_id
    ).select_related('author').order_by('created_at')
    data = [{
        'author': c.author.get_full_name() or c.author.username,
        'text': c.text,
        'created_at': c.created_at.astimezone(tz('Asia/Kolkata')).strftime('%b %d, %I:%M %p'),
    } for c in comments]
    return JsonResponse({'comments': data})


@login_required
def add_project_comment(request, project_id):
    if request.method != 'POST':
        return JsonResponse({'success': False}, status=400)
    text = request.POST.get('text', '').strip()
    if not text:
        return JsonResponse({'success': False, 'error': 'Empty comment'}, status=400)
    project = get_object_or_404(Project, pk=project_id)
    ProjectComment.objects.create(project=project, author=request.user, text=text)
    return JsonResponse({'success': True})


# ==========================
# 12. MISC UTILITIES
# ==========================

@login_required
def switch_member(request):
    if request.method == 'POST':
        request.session['current_member_id'] = int(request.POST.get('member_id'))

    return redirect(request.META.get('HTTP_REFERER', 'home'))

# ==========================
# 13. MANAGE USERS (ADMIN)
# ==========================

@login_required
def manage_users_list(request):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    users = User.objects.all().order_by('username')
    data = [{
        'id': u.id,
        'username': u.username,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'email': u.email,
        'is_staff': u.is_staff,
    } for u in users]
    return JsonResponse({'users': data})


@login_required
def manage_user_delete(request, user_id):
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'message': 'Forbidden'}, status=403)
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)
    user = get_object_or_404(User, pk=user_id)
    if user == request.user:
        return JsonResponse({'success': False, 'message': 'You cannot delete your own account.'})
    if user.is_staff:
        return JsonResponse({'success': False, 'message': 'Cannot delete another admin.'})
    username = user.username
    user.delete()
    return JsonResponse({'success': True, 'message': f'User @{username} deleted.'})


@login_required
def manage_user_reset_password(request, user_id):
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'message': 'Forbidden'}, status=403)
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)
    import json as _json
    body = _json.loads(request.body)
    new_password = body.get('password', '').strip()
    if len(new_password) < 6:
        return JsonResponse({'success': False, 'message': 'Password must be at least 6 characters.'})
    user = get_object_or_404(User, pk=user_id)
    user.set_password(new_password)
    user.save()
    return JsonResponse({'success': True, 'message': f'Password for @{user.username} has been reset.'})