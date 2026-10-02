from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
import uuid


# =========================
# PROJECT
# =========================
class Project(models.Model):
    STATUS_CHOICES = [
        ('yet_to_start', 'TO DO'),
        ('on_hold', 'In Progress'),
        ('in_review', 'In Review'),
        ('completed', 'Completed'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='yet_to_start')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    members = models.ManyToManyField(User, related_name='projects', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    

    def __str__(self):
        return self.name


# =========================
# PROJECT DOCUMENT
# =========================
class ProjectDocument(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='documents')
    file = models.FileField(upload_to='project_documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.project.name} - {self.file.name}"


# =========================
# INVITE
# =========================
class Invite(models.Model):
    email = models.EmailField()
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True)
    accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)


# =========================
# NOTIFICATION
# =========================
class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.message[:30]}"


# =========================
# CHAT MESSAGE (Direct)
# =========================
class ChatMessage(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_messages')
    message = models.TextField()
    hidden_for = models.ManyToManyField(User, related_name='hidden_messages', blank=True)
    is_deleted = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sender.username} -> {'All' if not self.recipient else self.recipient.username}: {self.message[:30]}"


# =========================
# GROUP CHAT
# =========================
class GroupChat(models.Model):
    name = models.CharField(max_length=100)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_groups')
    members = models.ManyToManyField(User, related_name='group_chats')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# =========================
# GROUP MESSAGE
# =========================
class GroupMessage(models.Model):
    group = models.ForeignKey(GroupChat, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_messages_sent')
    message = models.TextField()
    is_deleted = models.BooleanField(default=False)
    hidden_for = models.ManyToManyField(User, blank=True, related_name='hidden_group_messages')
    is_read_by = models.ManyToManyField(User, blank=True, related_name='read_group_messages')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.group.name}] {self.sender.username}: {self.message[:40]}"


# =========================
# PROJECT COMMENT
# =========================
class ProjectComment(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.project.name} - {self.author.username}: {self.text[:30]}"