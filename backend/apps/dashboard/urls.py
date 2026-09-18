from django.urls import path
from .views import ResumenView, CostosLoteView

urlpatterns = [
    path('resumen/', ResumenView.as_view(), name='dashboard-resumen'),
    path('costos-lote/<int:lote_id>/', CostosLoteView.as_view(), name='dashboard-costos-lote'),
]