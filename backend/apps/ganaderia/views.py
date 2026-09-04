from rest_framework import viewsets
from .models import Raza, Lote, Animal, PesoAnimal
from .serializers import RazaSerializer, LoteSerializer, AnimalSerializer, PesoAnimalSerializer


class RazaViewSet(viewsets.ModelViewSet):
    queryset = Raza.objects.all()
    serializer_class = RazaSerializer


class LoteViewSet(viewsets.ModelViewSet):
    queryset = Lote.objects.all()
    serializer_class = LoteSerializer


class AnimalViewSet(viewsets.ModelViewSet):
    queryset = Animal.objects.all()
    serializer_class = AnimalSerializer


class PesoAnimalViewSet(viewsets.ModelViewSet):
    queryset = PesoAnimal.objects.all()
    serializer_class = PesoAnimalSerializer