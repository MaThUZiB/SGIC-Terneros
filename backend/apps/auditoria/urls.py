from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegistroAuditoriaViewSet

router = DefaultRouter()
router.register(r'registros-auditoria', RegistroAuditoriaViewSet, basename='registro-auditoria')

urlpatterns = [
    path('', include(router.urls)),
]