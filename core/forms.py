from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import User
from .models import Project


# =========================
# LOGIN FORM
# =========================
class LoginForm(AuthenticationForm):
    username = forms.CharField(
        widget=forms.TextInput(attrs={
            'class': 'w-full pl-10 pr-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm'
        })
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'w-full pl-10 pr-10 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm'
        })
    )


# =========================
# PROJECT FORM
# =========================
class ProjectForm(forms.ModelForm):

    members = forms.ModelMultipleChoiceField(
        queryset=User.objects.all(),
        widget=forms.SelectMultiple(attrs={
            'class': 'w-full px-4 py-3 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-32'
        })
    )

    class Meta:
        model = Project
        fields = [
            'name',
            'description',
            'members',
            'status',
            'priority',
            'start_date',
            'due_date',
        ]

        widgets = {
            'start_date': forms.DateInput(attrs={
                'type': 'date',
                'class': 'w-full px-4 py-3 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500'
            }),
            'due_date': forms.DateInput(attrs={
                'type': 'date',
                'class': 'w-full px-4 py-3 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500'
            }),
            'priority': forms.RadioSelect(attrs={'class': 'peer hidden'}),
            'status': forms.Select(attrs={
                'class': 'w-full px-4 py-3 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500'
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields['status'].choices = Project.STATUS_CHOICES

        self.fields['name'].widget.attrs.update({
            'class': 'w-full px-4 py-3 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500',
            'placeholder': 'Enter project name'
        })

        self.fields['description'].widget.attrs.update({
            'class': 'w-full px-4 py-3 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-32',
            'placeholder': 'Brief description of the project (optional)'
        })