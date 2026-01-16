import React, { useEffect, useState } from "react";
import { Review } from "../Entities/Review";
import { Card, CardContent } from "../Components/ui/card";
import { Badge } from "../Components/ui/badge";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../Components/ui/select";
import {
  Search,
  MessageSquare,
  Eye,
  EyeOff,
  Star,
  RefreshCcw,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS = {
  pending: "En attente",
  published: "Publiée",
  hidden: "Masquée",
};

const STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-800",
  published: "bg-green-100 text-green-800",
  hidden: "bg-gray-200 text-gray-700",
};

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadReviews({ resetPage: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, ratingFilter]);

  const loadReviews = async ({ resetPage = false } = {}) => {
    if (resetPage) setPage(1);
    setIsLoading(true);
    try {
      const res = await Review.list({
        page: resetPage ? 1 : page,
        pageSize,
        status: statusFilter,
        rating: ratingFilter,
        search: search.trim(),
      });
      setReviews(res.data || []);
      setTotal(res.total || 0);
    } catch (error) {
      console.error("Erreur de récupération des avis", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async (review) => {
    const nextStatus = review.status === "published" ? "hidden" : "published";
    setIsLoading(true);
    try {
      await Review.updateStatus(review.id, nextStatus);
      loadReviews();
    } catch (error) {
      console.error("Erreur de mise à jour du statut", error);
      setIsLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1 text-amber-500">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Star
            key={idx}
            className={`w-4 h-4 ${
              idx < rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Avis & commentaires
          </h1>
          <p className="text-gray-600">
            Modérez les avis liés aux commandes clients
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => loadReviews()}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" />
          Rafraîchir
        </Button>
      </div>

      {/* Filtres */}
      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Recherche texte dans le commentaire..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="published">Publiés</SelectItem>
            <SelectItem value="hidden">Masqués</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={ratingFilter}
          onValueChange={(v) => {
            setRatingFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Note" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les notes</SelectItem>
            {[5, 4, 3, 2, 1].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} étoiles
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end mb-6">
        <Button
          onClick={() => loadReviews({ resetPage: true })}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          Appliquer les filtres
        </Button>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun avis pour ces filtres</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {reviews.map((review) => (
            <Card key={review.id} className="border border-gray-200 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User className="w-4 h-4" />
                      <span>{review.user?.full_name || "Utilisateur"}</span>
                      <span className="text-gray-400">•</span>
                      <span>
                        Cmd {review.order?.order_code || review.order?.id}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {review.order?.created_date
                        ? format(new Date(review.order.created_date), "Pp", { locale: fr })
                        : null}
                    </div>
                  </div>
                  <Badge className={STATUS_BADGE[review.status] || ""}>
                    {STATUS_LABELS[review.status] || review.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {renderStars(review.rating)}
                  <span className="text-sm text-gray-500">({review.rating}/5)</span>
                </div>

                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                  {review.comment}
                </p>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Créé le{" "}
                    {format(new Date(review.created_at), "Pp", { locale: fr })}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStatus(review)}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    {review.status === "published" ? (
                      <>
                        <EyeOff className="w-4 h-4" /> Masquer
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" /> Publier
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6 text-sm text-gray-600">
        <span>
          Page {page} / {totalPages} · {total} avis
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}

