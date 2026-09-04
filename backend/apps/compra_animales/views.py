from rest_framework import viewsets
from .models import Proveedor, CompraAnimal, DetalleCompraAnimal
from .serializers import ProveedorSerializer, CompraAnimalSerializer, DetalleCompraAnimalSerializer


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer


class CompraAnimalViewSet(viewsets.ModelViewSet):
    queryset = CompraAnimal.objects.all()
    serializer_class = CompraAnimalSerializer


class DetalleCompraAnimalViewSet(viewsets.ModelViewSet):
    queryset = DetalleCompraAnimal.objects.all()
    serializer_class = DetalleCompraAnimalSerializer