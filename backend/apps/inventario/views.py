from rest_framework import viewsets
from .models import (
    CategoriaProducto, UnidadMedida, Producto, 
    PresentacionProducto, ConversionProducto, MovimientoInventario
)
from .serializers import (
    CategoriaProductoSerializer, UnidadMedidaSerializer, ProductoSerializer,
    PresentacionProductoSerializer, ConversionProductoSerializer, MovimientoInventarioSerializer
)


class CategoriaProductoViewSet(viewsets.ModelViewSet):
    queryset = CategoriaProducto.objects.all()
    serializer_class = CategoriaProductoSerializer


class UnidadMedidaViewSet(viewsets.ModelViewSet):
    queryset = UnidadMedida.objects.all()
    serializer_class = UnidadMedidaSerializer


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer


class PresentacionProductoViewSet(viewsets.ModelViewSet):
    queryset = PresentacionProducto.objects.all()
    serializer_class = PresentacionProductoSerializer


class ConversionProductoViewSet(viewsets.ModelViewSet):
    queryset = ConversionProducto.objects.all()
    serializer_class = ConversionProductoSerializer


class MovimientoInventarioViewSet(viewsets.ModelViewSet):
    queryset = MovimientoInventario.objects.all()
    serializer_class = MovimientoInventarioSerializer