import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import { useProductCatalog } from "@/hooks/useProductCatalog";

interface ProductCatalogSectionProps {
  userId: string;
}

export default function ProductCatalogSection({ userId }: ProductCatalogSectionProps) {
  const { items, loading, error, addItem, deleteItem } = useProductCatalog(userId);
  const [name, setName] = useState("");
  const [days, setDays] = useState("3");
  const [category, setCategory] = useState("Autre");

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed || !days) return;
    const d = parseInt(days);
    if (isNaN(d) || d < 1) return;
    await addItem(trimmed, d, category);
    setName("");
    setDays("3");
    setCategory("Autre");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Mon Catalogue Produits
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Ajoutez vos produits types pour pré-remplir automatiquement la DLC lors de la saisie.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-xs text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground p-2">Chargement...</p>
        ) : items.length > 0 ? (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Produit</TableHead>
                  <TableHead className="text-xs w-24">Catégorie</TableHead>
                  <TableHead className="text-xs w-24 text-center">DLC (jours)</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-sm text-center font-mono">{item.default_dlc_days}j</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground p-2">Aucun produit dans le catalogue</p>
        )}

        {/* Add form */}
        <div className="flex flex-wrap gap-2 items-end pt-1">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="Nom du produit (ex: Sauce Maison)"
            className="flex-1 min-w-[160px]"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            value={days}
            onChange={e => setDays(e.target.value)}
            placeholder="Jours"
            className="w-20 text-center"
          />
          <Button onClick={handleAdd} disabled={!name.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
