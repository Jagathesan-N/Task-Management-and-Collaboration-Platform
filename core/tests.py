from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from .models import Project, Notification, ChatMessage, GroupChat, GroupMessage, ProjectComment


# ==========================
# 1. PROJECT TESTS
# ==========================

class ProjectCreateTest(TestCase):
    """Test creating a project"""

    def setUp(self):
        # Create admin user
        self.admin = User.objects.create_user(
            username='admin',
            password='admin123',
            is_staff=True
        )
        # Create normal user
        self.user = User.objects.create_user(
            username='testuser',
            password='user123'
        )
        self.client = Client()

    def test_admin_can_create_project(self):
        """Admin should be able to create a project"""
        self.client.login(username='admin', password='admin123')
        response = self.client.post(reverse('project_create'), {
            'name': 'Test Project',
            'description': 'Test Description',
            'status': 'yet_to_start',
            'priority': 'medium',
            'members': [self.user.id],
        })
        # Project should be created
        self.assertEqual(Project.objects.count(), 1)
        self.assertEqual(Project.objects.first().name, 'Test Project')

    def test_normal_user_cannot_create_project(self):
        """Normal user should NOT be able to create a project"""
        self.client.login(username='testuser', password='user123')
        response = self.client.post(reverse('project_create'), {
            'name': 'Hacked Project',
            'status': 'yet_to_start',
            'priority': 'medium',
        })
        # Project should NOT be created
        self.assertEqual(Project.objects.count(), 0)


class ProjectEditTest(TestCase):
    """Test editing a project"""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin',
            password='admin123',
            is_staff=True
        )
        self.user = User.objects.create_user(
            username='testuser',
            password='user123'
        )
        # Create a project to edit
        self.project = Project.objects.create(
            name='Old Name',
            status='yet_to_start',
            priority='medium'
        )
        self.client = Client()

    def test_admin_can_edit_project(self):
        """Admin should be able to edit a project"""
        self.client.login(username='admin', password='admin123')
        response = self.client.post(reverse('project_edit', kwargs={'pk': self.project.pk}), {
            'name': 'New Name',
            'status': 'yet_to_start',
            'priority': 'high',
            'members': [self.user.id],
        })
        # Print form errors for debugging
        if hasattr(response, 'context') and response.context and 'form' in response.context:
            print("FORM ERRORS:", response.context['form'].errors)
        # Project name should be updated
        self.project.refresh_from_db()
        self.assertEqual(self.project.name, 'New Name')
        self.assertEqual(self.project.status, 'yet_to_start')

    def test_normal_user_cannot_edit_project(self):
        """Normal user should NOT be able to edit a project"""
        self.client.login(username='testuser', password='user123')
        response = self.client.post(reverse('project_edit', kwargs={'pk': self.project.pk}), {
            'name': 'Hacked Name',
            'status': 'yet_to_start',
            'priority': 'medium',
        })
        # Project name should NOT change
        self.project.refresh_from_db()
        self.assertEqual(self.project.name, 'Old Name')


class ProjectDeleteTest(TestCase):
    """Test deleting a project"""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin',
            password='admin123',
            is_staff=True
        )
        self.user = User.objects.create_user(
            username='testuser',
            password='user123'
        )
        self.project = Project.objects.create(
            name='Project to Delete',
            status='yet_to_start',
            priority='medium'
        )
        self.client = Client()

    def test_admin_can_delete_project(self):
        """Admin should be able to delete a project"""
        self.client.login(username='admin', password='admin123')
        response = self.client.post(reverse('project_delete', kwargs={'pk': self.project.pk}))
        # Project should be deleted
        self.assertEqual(Project.objects.count(), 0)

    def test_normal_user_cannot_delete_project(self):
        """Normal user should NOT be able to delete a project"""
        self.client.login(username='testuser', password='user123')
        response = self.client.post(reverse('project_delete', kwargs={'pk': self.project.pk}))
        # Project should still exist
        self.assertEqual(Project.objects.count(), 1)


class ProjectStatusUpdateTest(TestCase):
    """Test updating project status (Kanban drag and drop)"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='user123'
        )
        self.project = Project.objects.create(
            name='Test Project',
            status='yet_to_start',
            priority='medium'
        )
        self.client = Client()

    def test_status_update(self):
        """Status should update correctly"""
        self.client.login(username='testuser', password='user123')
        response = self.client.post(
            reverse('update_project_status', kwargs={'project_id': self.project.pk}),
            {'status': 'on_hold'}
        )
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, 'on_hold')

    def test_invalid_status_rejected(self):
        """Invalid status should be rejected"""
        self.client.login(username='testuser', password='user123')
        response = self.client.post(
            reverse('update_project_status', kwargs={'project_id': self.project.pk}),
            {'status': 'invalid_status'}
        )
        self.assertEqual(response.status_code, 400)


# ==========================
# 2. NOTIFICATION TESTS
# ==========================

class NotificationTest(TestCase):
    """Test notifications"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='user123'
        )

    def test_notification_created(self):
        """Notification should be created correctly"""
        Notification.objects.create(
            user=self.user,
            message='You have been added to project: Test'
        )
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(Notification.objects.first().is_read, False)

    def test_mark_notification_read(self):
        """Notification should be marked as read"""
        notification = Notification.objects.create(
            user=self.user,
            message='Test notification'
        )
        self.client = Client()
        self.client.login(username='testuser', password='user123')
        self.client.post(reverse('mark_notification_read', kwargs={'notification_id': notification.pk}))
        notification.refresh_from_db()
        self.assertEqual(notification.is_read, True)


# ==========================
# 3. CHAT TESTS
# ==========================

class ChatMessageTest(TestCase):
    """Test direct messages"""

    def setUp(self):
        self.sender = User.objects.create_user(
            username='sender',
            password='sender123'
        )
        self.recipient = User.objects.create_user(
            username='recipient',
            password='recipient123'
        )
        self.client = Client()

    def test_send_message(self):
        """Message should be sent correctly"""
        self.client.login(username='sender', password='sender123')
        response = self.client.post(reverse('send_message'), {
            'message': 'Hello!',
            'recipient_id': self.recipient.id
        })
        self.assertEqual(ChatMessage.objects.count(), 1)
        self.assertEqual(ChatMessage.objects.first().message, 'Hello!')

    def test_delete_message(self):
        """Message should be soft deleted"""
        msg = ChatMessage.objects.create(
            sender=self.sender,
            recipient=self.recipient,
            message='Delete me'
        )
        self.client.login(username='sender', password='sender123')
        self.client.post(reverse('delete_message', kwargs={'message_id': msg.pk}))
        msg.refresh_from_db()
        self.assertEqual(msg.is_deleted, True)
        self.assertEqual(msg.message, 'This message was deleted')


# ==========================
# 4. PROJECT COMMENT TESTS
# ==========================

class ProjectCommentTest(TestCase):
    """Test project comments"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='user123'
        )
        self.project = Project.objects.create(
            name='Test Project',
            status='yet_to_start',
            priority='medium'
        )
        self.client = Client()

    def test_add_comment(self):
        """Comment should be added correctly"""
        self.client.login(username='testuser', password='user123')
        response = self.client.post(
            reverse('add_project_comment', kwargs={'project_id': self.project.pk}),
            {'text': 'This is a comment'}
        )
        self.assertEqual(ProjectComment.objects.count(), 1)
        self.assertEqual(ProjectComment.objects.first().text, 'This is a comment')

    def test_empty_comment_rejected(self):
        """Empty comment should be rejected"""
        self.client.login(username='testuser', password='user123')
        response = self.client.post(
            reverse('add_project_comment', kwargs={'project_id': self.project.pk}),
            {'text': ''}
        )
        # Comment should NOT be created
        self.assertEqual(ProjectComment.objects.count(), 0)


# ==========================
# 5. MODEL TESTS
# ==========================

class ProjectModelTest(TestCase):
    """Test Project model"""

    def test_project_str(self):
        """Project __str__ should return project name"""
        project = Project.objects.create(
            name='My Project',
            status='yet_to_start',
            priority='medium'
        )
        self.assertEqual(str(project), 'My Project')

    def test_default_status(self):
        """Default status should be yet_to_start"""
        project = Project.objects.create(
            name='My Project',
            priority='medium'
        )
        self.assertEqual(project.status, 'yet_to_start')

    def test_default_priority(self):
        """Default priority should be medium"""
        project = Project.objects.create(name='My Project')
        self.assertEqual(project.priority, 'medium')