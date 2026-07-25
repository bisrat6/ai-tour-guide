import 'package:flutter/material.dart';

/// Named routes and navigation helpers for the Stitch export flow.
class StitchRoutes {
  StitchRoutes._();

  static const String welcome = '/';
  static const String validate = '/validate';
  static const String validated = '/validated';
  static const String error = '/error';
  static const String home = '/home';
  static const String narration = '/narration';
  static const String shopProduct = '/shop/product';
  static const String shopEmptyBag = '/shop/empty-bag';

  static bool isValidTicket(String code) {
    final String normalized = code.trim().toUpperCase();
    if (normalized.isEmpty) {
      return false;
    }
    if (normalized == 'INVALID' || normalized.contains('ERR')) {
      return false;
    }
    return true;
  }

  static void submitTicket(
    BuildContext context,
    String code, {
    bool replaceOnSuccess = true,
  }) {
    if (isValidTicket(code)) {
      if (replaceOnSuccess) {
        Navigator.pushReplacementNamed(context, validated);
      } else {
        Navigator.pushNamed(context, validated, arguments: true);
      }
    } else {
      Navigator.pushNamed(context, error);
    }
  }

  static Route<dynamic> fadeRoute(Widget page) {
    return PageRouteBuilder<dynamic>(
      pageBuilder: (_, __, ___) => page,
      transitionsBuilder: (_, Animation<double> animation, __, Widget child) {
        return FadeTransition(opacity: animation, child: child);
      },
      transitionDuration: const Duration(milliseconds: 350),
    );
  }
}
