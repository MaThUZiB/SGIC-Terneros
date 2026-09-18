from rest_framework import viewsets, status, decorators
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from .models import Raza, Lote, Animal, PesoAnimal
from .serializers import RazaSerializer, LoteSerializer, AnimalSerializer, PesoAnimalSerializer
from .services import marcar_fallecido, dividir_lote


class RazaViewSet(viewsets.ModelViewSet):
    queryset = Raza.objects.all()
    serializer_class = RazaSerializer


class LoteViewSet(viewsets.ModelViewSet):
    queryset = Lote.objects.select_related('lote_origen').prefetch_related(
        'animales__raza', 'animales__pesajes').all()
    serializer_class = LoteSerializer

    @decorators.action(detail=True, methods=['post'])
    def dividir(self, request, pk=None):
        lote = self.get_object()
        animales_ids = request.data.get('animales_ids') or []
        nuevo_codigo = (request.data.get('nuevo_codigo') or '').strip()
        if not nuevo_codigo:
            raise ValidationError({'nuevo_codigo': 'Campo requerido.'})
        derivado = dividir_lote(
            lote,
            nuevo_codigo=nuevo_codigo,
            animales_ids=animales_ids,
            usuario=request.user,
            fecha=request.data.get('fecha'),
            observaciones=request.data.get('observaciones', ''),
        )
        derivado.refresh_from_db()
        return Response(self.get_serializer(derivado).data, status=status.HTTP_201_CREATED)


class AnimalViewSet(viewsets.ModelViewSet):
    queryset = Animal.objects.select_related('lote', 'raza').prefetch_related('pesajes', 'tratamientos').all()
    serializer_class = AnimalSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        lote = self.request.query_params.get('lote')
        diio = self.request.query_params.get('diio')
        estado = self.request.query_params.get('estado')
        if lote:
            qs = qs.filter(lote_id=lote)
        if diio:
            qs = qs.filter(diio__icontains=diio)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    @decorators.action(detail=True, methods=['post'])
    def marcar_fallecido(self, request, pk=None):
        animal = self.get_object()
        marcar_fallecido(animal, request.user, request.data.get('observaciones', ''))
        animal.refresh_from_db()
        return Response(self.get_serializer(animal).data)


class PesoAnimalViewSet(viewsets.ModelViewSet):
    queryset = PesoAnimal.objects.select_related('animal').all()
    serializer_class = PesoAnimalSerializer