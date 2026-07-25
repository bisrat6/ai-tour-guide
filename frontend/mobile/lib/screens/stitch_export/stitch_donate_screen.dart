import 'package:flutter/material.dart';

import 'stitch_theme.dart';

class StitchDonateScreen extends StatelessWidget {
  const StitchDonateScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: StitchTheme.parchmentLight,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Icon(
                  Icons.volunteer_activism_outlined,
                  size: 64,
                  color: StitchTheme.adwaGold.withValues(alpha: 0.9),
                ),
                const SizedBox(height: 20),
                Text(
                  'Support the Gallery',
                  textAlign: TextAlign.center,
                  style: StitchTheme.headline(
                    size: 32,
                    color: StitchTheme.darkText,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Donation options will be available in a future release.',
                  textAlign: TextAlign.center,
                  style: StitchTheme.body(
                    size: 16,
                    color: StitchTheme.slate.withValues(alpha: 0.85),
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: showBottomNav
          ? const StitchBottomNav(activeIndex: 3, lightMode: true)
          : null,
    );
  }
}
