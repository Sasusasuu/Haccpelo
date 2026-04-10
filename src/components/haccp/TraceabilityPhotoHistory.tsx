import { useState, useMemo } from "react";
import { useTraceabilityPhotos } from "@/hooks/useTraceabilityPhotos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Calendar, Search, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/loading-skeletons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  userId: string;
}

const CATEGORIES = ["Toutes", "Viande", "Poisson", "Produits laitiers", "Légumes", "Fruits", "Charcuterie", "Épicerie", "Boissons", "Autre"];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

export default function TraceabilityPhotoHistory({ userId }: Props) {
  const { photos, loading, error } = useTraceabilityPhotos(userId);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Toutes");
  const [selectedPhoto, setSelectedPhoto] = useState<typeof photos[0] | null>(null);

  const filtered = useMemo(() => {
    return photos.filter(p => {
      if (category !== "Toutes" && p.categorie !== category) return false;
      if (search && !p.product_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [photos, search, category]);

  if (loading) return <CardSkeleton count={1} />;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-5 w-5 text-muted-foreground" />
            Historique des photos de traçabilité
            <Badge variant="secondary" className="ml-auto">{photos.length} photo{photos.length > 1 ? "s" : ""}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Conservation automatique de 3 mois • Les photos plus anciennes sont supprimées automatiquement
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un produit…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageOff className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{photos.length === 0 ? "Aucune photo de traçabilité enregistrée" : "Aucun résultat pour ce filtre"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative rounded-lg overflow-hidden border bg-muted/30 hover:ring-2 hover:ring-primary/50 transition-all aspect-square"
                >
                  <img
                    src={photo.photo_url}
                    alt={photo.product_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                    <p className="text-xs font-medium text-white truncate">{photo.product_name}</p>
                    <p className="text-[10px] text-white/70">{timeAgo(photo.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              {selectedPhoto?.product_name}
            </DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-3">
              <img
                src={selectedPhoto.photo_url}
                alt={selectedPhoto.product_name}
                className="w-full rounded-lg"
              />
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{selectedPhoto.categorie}</Badge>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(selectedPhoto.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
