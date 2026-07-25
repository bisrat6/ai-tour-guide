import 'package:flutter/material.dart';

import 'stitch_routes.dart';
import 'stitch_theme.dart';

class StitchShopEmptyBagScreen extends StatelessWidget {
  const StitchShopEmptyBagScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: StitchTheme.parchment,
      body: SafeArea(
        child: Stack(
          children: <Widget>[
            Positioned.fill(
              child: Align(
                child: Container(
                  width: 320,
                  height: 320,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2D9C5).withValues(alpha: 0.5),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
            Column(
              children: <Widget>[
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 10, 24, 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEBE2CF),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(Icons.menu),
                      ),
                      Text(
                        'THE GALLERY',
                        style: StitchTheme.headline(
                          size: 22,
                          color: StitchTheme.darkText,
                          letterSpacing: 2.8,
                        ),
                      ),
                      IconButton(
                        onPressed: () {},
                        icon: const Icon(Icons.near_me_outlined),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 24),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
                  decoration: BoxDecoration(
                    color: const Color(0x99FBF8F1),
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(
                      color: StitchTheme.darkText.withValues(alpha: 0.06),
                    ),
                  ),
                  child: Column(
                    children: <Widget>[
                      Container(
                        width: 92,
                        height: 92,
                        decoration: const BoxDecoration(
                          color: Color(0xFFFBF8F1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.shopping_bag_outlined,
                          size: 46,
                          color: StitchTheme.muted,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Your Bag is Empty',
                        style: StitchTheme.headline(
                          size: 34,
                          color: StitchTheme.darkText,
                          weight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Discover unique souvenirs and art prints inspired by our collections.',
                        textAlign: TextAlign.center,
                        style: StitchTheme.body(
                          size: 18,
                          color: StitchTheme.slate.withValues(alpha: 0.82),
                        ),
                      ),
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: () {
                          Navigator.pushNamedAndRemoveUntil(
                            context,
                            StitchRoutes.home,
                            (Route<dynamic> route) => false,
                            arguments: 1,
                          );
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: StitchTheme.adwaGold,
                          foregroundColor: StitchTheme.darkText,
                          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                        icon: const Icon(Icons.arrow_forward),
                        label: Text(
                          'Browse Shop',
                          style: StitchTheme.overline(
                            size: 12,
                            color: StitchTheme.darkText,
                            letterSpacing: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
