from rest_framework import viewsets
from .models import CompraInsumo, DetalleCompraInsumo
from .serializers import CompraInsumoSerializer, DetalleCompraInsumoSerializer


class CompraInsumoViewSet(viewsets.ModelViewSet):
    queryset = CompraInsumo.objects.all()
    serializer_class = CompraInsumoSerializer


class DetalleCompraInsumoViewSet(viewsets.ModelViewSet):
    queryset = DetalleCompraInsumo.objects.all()
    serializer_class = DetalleCompraInsumoSerializer