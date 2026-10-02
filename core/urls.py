from django.urls import path
from . import views
from .views import CustomLoginView
from django.contrib.auth.views import LogoutView

urlpatterns = [

    # =========================
    # LOGIN (FIRST PAGE)
    # =========================
    path('', CustomLoginView.as_view(), name='root'),
    path('login/', CustomLoginView.as_view(), name='login'),

    # =========================
    # DASHBOARD
    # =========================
    path('home/', views.home, name='home'),
    path('logout/', LogoutView.as_view(), name='logout'),

    # =========================
    # PROJECTS
    # =========================
    path('projects/create/', views.project_create, name='project_create'),
    path('projects/<int:pk>/edit/', views.project_edit, name='project_edit'),
    path('projects/<int:pk>/delete/', views.project_delete, name='project_delete'),
    path('projects/<int:pk>/kanban/', views.kanban_board, name='kanban_board'),
    path('projects/<int:project_id>/update-status/', views.update_project_status, name='update_project_status'),
    path('projects/<int:project_id>/assign-member/', views.assign_project_member, name='assign_project_member'),

    # =========================
    # USER / MEMBER
    # =========================
    path('switch-member/', views.switch_member, name='switch_member'),

    # =========================
    # INBOX
    # =========================
    path('inbox/', views.inbox, name='inbox'),
    path('notifications/unread/', views.get_unread_notifications, name='unread_notifications'),
    path('notifications/<int:notification_id>/read/', views.mark_notification_read, name='mark_notification_read'),

    # =========================
    # CALENDAR
    # =========================
    path('calendar/', views.calendar_view, name='calendar'),

    # =========================
    # CHAT (Direct Messages)
    # =========================
    path('chat/', views.chat_view, name='chat'),
    path('chat/send/', views.send_message, name='send_message'),
    path('chat/messages/', views.get_messages, name='get_messages'),
    path('chat/delete/<int:message_id>/', views.delete_message, name='delete_message'),
    path('chat/delete-for-me/<int:message_id>/', views.delete_message_for_me, name='delete_message_for_me'),
    path('chat/unread-counts/', views.get_unread_counts, name='unread_counts'),
    path('chat/mark-read/', views.mark_conversation_read, name='mark_conversation_read'),
    path('chat/clear-all/', views.clear_all_chat, name='clear_all_chat'),

    # =========================
    # GROUP CHAT
    # =========================
    path('chat/groups/create/', views.create_group_chat, name='create_group_chat'),
    path('chat/groups/<int:group_id>/members/', views.get_group_members, name='get_group_members'),
    path('chat/groups/<int:group_id>/', views.group_chat_view, name='group_chat_view'),
    path('chat/groups/<int:group_id>/send/', views.send_group_message, name='send_group_message'),
    path('chat/groups/<int:group_id>/messages/', views.get_group_messages, name='get_group_messages'),
    path('chat/groups/<int:group_id>/leave/', views.leave_group, name='leave_group'),
    path('chat/groups/<int:group_id>/delete/', views.delete_group, name='delete_group'),
    path('chat/group-messages/<int:message_id>/delete/', views.delete_group_message, name='delete_group_message'),
    path('chat/group-messages/<int:message_id>/delete-for-me/', views.delete_group_message_for_me, name='delete_group_message_for_me'),

    # =========================
    # INVITES
    # =========================
    path('send-invite/0/', views.send_invite, {'project_id': 0}, name='send_invite_no_project'),
    path('send-invite/<int:project_id>/', views.send_invite, name='send_invite'),
    path('accept-invite/<uuid:token>/', views.accept_invite, name='accept_invite'),
    
    path('projects/<int:project_id>/comments/', views.get_project_comments, name='get_project_comments'),
    path('projects/<int:project_id>/comments/add/', views.add_project_comment, name='add_project_comment'),

    # =========================
    # MANAGE USERS (ADMIN)
    # =========================
    path('manage-users/list/', views.manage_users_list, name='manage_users_list'),
    path('manage-users/<int:user_id>/delete/', views.manage_user_delete, name='manage_user_delete'),
    path('manage-users/<int:user_id>/reset-password/', views.manage_user_reset_password, name='manage_user_reset_password'),
]