import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'screens/stitch_export/stitch_app_shell.dart';
import 'screens/stitch_export/stitch_narration_detail_screen.dart';
import 'screens/stitch_export/stitch_routes.dart';
import 'screens/stitch_export/stitch_shop_empty_bag_screen.dart';
import 'screens/stitch_export/stitch_shop_product_detail_screen.dart';
import 'screens/stitch_export/stitch_ticket_error_screen.dart';
import 'screens/stitch_export/stitch_ticket_validated_screen.dart';
import 'screens/stitch_export/stitch_ticket_validation_screen.dart';
import 'screens/stitch_export/stitch_welcome_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );

  runApp(const HeritageGalleryApp());
}

class HeritageGalleryApp extends StatelessWidget {
  const HeritageGalleryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Heritage Gallery',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(useMaterial3: true),
      initialRoute: StitchRoutes.welcome,
      onGenerateRoute: _onGenerateRoute,
    );
  }

  static Route<dynamic> _onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case StitchRoutes.welcome:
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const StitchWelcomeScreen(),
        );
      case StitchRoutes.validate:
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const StitchTicketValidationScreen(),
        );
      case StitchRoutes.validated:
        return StitchRoutes.fadeRoute(const StitchTicketValidatedScreen());
      case StitchRoutes.error:
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const StitchTicketErrorScreen(),
        );
      case StitchRoutes.home:
        final int initialIndex =
            settings.arguments is int ? settings.arguments! as int : 0;
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => StitchAppShell(initialIndex: initialIndex),
        );
      case StitchRoutes.narration:
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const StitchNarrationDetailScreen(),
        );
      case StitchRoutes.shopProduct:
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const StitchShopProductDetailScreen(),
        );
      case StitchRoutes.shopEmptyBag:
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const StitchShopEmptyBagScreen(),
        );
      default:
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const StitchWelcomeScreen(),
        );
    }
  }
}
