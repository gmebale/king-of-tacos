import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { useAuthContext } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import { ArrowRight, Star, Clock, Heart, Sparkles } from "lucide-react";
import { Button } from "../Components/ui/button";
import { Card } from "../Components/ui/card";
import api from "../services/api.service";
import { resolveMediaUrl } from "../utils/media";

export default function Home() {
  const { isAuthenticated } = useAuthContext();
  const [heroMedia, setHeroMedia] = useState({ media_url: '', media_type: '', overlay_opacity: 85 });
  const [reviews, setReviews] = useState({ data: [], total: 0, average_rating: 0 });

  useEffect(() => {
    window.scrollTo(0, 0);
    api.get('/settings/homepage').then(response => setHeroMedia(response.data)).catch(() => {});
    api.get('/reviews/public').then(response => setReviews(response.data)).catch(() => {});
  }, []);

  const features = [
  {
    icon: Clock,
    title: "Rapide",
    description: "Commande prête en 10 minutes"
  },
  {
    icon: Heart,
    title: "Qualité",
    description: "Ingrédients frais du jour"
  },
  {
    icon: Star,
    title: "Savoureux",
    description: "Recettes authentiques"
  }];


  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50">
        {heroMedia.media_url && (heroMedia.media_type === 'video' ? (
          <video
            key={heroMedia.media_url}
            src={resolveMediaUrl(heroMedia.media_url)}
            autoPlay
            muted
            loop
            playsInline
            controls
            aria-label="Vidéo de présentation du restaurant"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={resolveMediaUrl(heroMedia.media_url)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
        ))}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100"
          style={{ opacity: Math.max(0, Math.min(100, Number(heroMedia.overlay_opacity ?? 85))) / 100 }}
        />
        
        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center">

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white rounded-full text-sm font-medium mb-6 shadow-lg">

              <Sparkles className="w-4 h-4" />
              <span>Votre restaurant de tacos à Libreville</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-amber-600 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
                King Of Tacos
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto">
              À Libreville, découvrez nos tacos authentiques, préparés avec passion et des ingrédients de qualité
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to={createPageUrl("Menu")}>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white px-8 py-6 text-lg rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 group">

                  Commander maintenant
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}>

                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </motion.div>
                </Button>
              </Link>

              <Link to={createPageUrl("Menu")}>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-amber-600 text-amber-600 hover:bg-amber-50 px-8 py-6 text-lg rounded-2xl">

                  Voir le menu
                </Button>
              </Link>
            </div>

            {!isAuthenticated && (
              <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center items-center text-sm text-gray-500">
                <Link to={createPageUrl("Login")} className="hover:text-amber-600 transition-colors">
                  Se connecter
                </Link>
                <span className="hidden sm:block">•</span>
                <Link to={createPageUrl("Register")} className="hover:text-amber-600 transition-colors">
                  S'inscrire
                </Link>
              </div>
            )}
          </motion.div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-yellow-300 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-orange-300 rounded-full blur-3xl opacity-20" />
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16">

            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
              Pourquoi nous choisir ?
            </h2>
            <p className="text-gray-600 text-lg">
              Une expérience culinaire exceptionnelle
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) =>
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}>

                <Card className="bg-card text-center px-8 py-8 rounded-lg shadow-sm hover:shadow-2xl transition-all duration-300 border-2 hover:border-amber-400 group">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {reviews.data.length > 0 && (
        <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 to-white py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-12 flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
              <div>
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-amber-700">Ils en parlent mieux que nous</p>
                <h2 className="text-4xl font-black text-slate-900 md:text-5xl">Les avis de nos clients</h2>
                <p className="mt-3 text-lg text-slate-600">Des expériences partagées après leur commande.</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-white px-6 py-4 shadow-sm">
                <div className="flex items-center justify-center gap-1" aria-label={`Note moyenne ${reviews.average_rating} sur 5`}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} className={`h-5 w-5 ${star <= Math.round(reviews.average_rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                  ))}
                </div>
                <p className="mt-1 text-center text-sm text-slate-600">
                  <strong className="text-slate-900">{reviews.average_rating.toFixed(1)}/5</strong> · {reviews.total} avis publiés
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reviews.data.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Card className="flex h-full flex-col rounded-3xl border border-amber-100 bg-white p-7 shadow-sm transition-shadow hover:shadow-xl">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex gap-1" aria-label={`Note ${review.rating} sur 5`}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {new Intl.DateTimeFormat('fr-GA', { month: 'long', year: 'numeric' }).format(new Date(review.created_at))}
                      </span>
                    </div>
                    <p className="flex-1 text-lg leading-relaxed text-slate-700">“{review.comment}”</p>
                    <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 font-bold text-white">
                        {(review.customer_name || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{review.customer_name}</p>
                        <p className="text-xs text-slate-500">Commande vérifiée</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-amber-600 to-yellow-500 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}>

            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Prêt à vous régaler ?
            </h2>
            <p className="text-xl mb-10 text-yellow-50">
              Commandez dès maintenant et récupérez votre commande en 10 minutes
            </p>
            <Link to={createPageUrl("Menu")}>
              <Button
                size="lg"
                className="bg-white text-amber-600 hover:bg-gray-100 px-10 py-6 text-lg rounded-2xl shadow-2xl">

                Découvrir le menu
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>);

}
