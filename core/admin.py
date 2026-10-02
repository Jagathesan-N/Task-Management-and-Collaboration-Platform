from django.contrib import admin
from .models import Project, Invite, Notification, ProjectDocument, ChatMessage, GroupChat, GroupMessage, ProjectComment

admin.site.register(Project)
admin.site.register(Invite)
admin.site.register(Notification)
admin.site.register(ProjectDocument)
admin.site.register(ChatMessage)
admin.site.register(GroupChat)
admin.site.register(GroupMessage)
admin.site.register(ProjectComment)