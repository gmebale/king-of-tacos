import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { useAuthContext } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import { ArrowRight, Star, Clock, Heart, Sparkles } from "lucide-react";
import { Button } from "../Components/ui/button";
import { Card } from "../Components/ui/card";

export default function Home() {
  const { isAuthenticated } = useAuthContext();

  useEffect(() => {
    window.scrollTo(0, 0);
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
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=1200')] bg-cover bg-center opacity-5" />
        
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
              <span>Le meilleur tacos de la ville</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-amber-600 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
                King Of Tacos
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Découvrez nos tacos authentiques, préparés avec passion et des ingrédients de qualité
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