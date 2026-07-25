import 'package:flutter/material.dart';

import 'stitch_routes.dart';
import 'stitch_theme.dart';

class StitchWelcomeScreen extends StatelessWidget {
  const StitchWelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          Image.network(
            'https://lh3.googleusercontent.com/aida-public/AB6AXuDFBfrIZsWKni9QgAENUSbgPpKLok0w__Kyv6aOJ__ZQ-6M18UR56s8qnGIQpWAavtQ_aCgkjih2A8KGGrRitmAtjNFEd33SI2z1K_tWYYzB4aMsyJ7F2VgN3ZUPNzaCNDQnZNOgENEsmcgs5esh5y-ZSmVMHKpLa059xNErwnTrX_1KTpsAcJ2c2V_wJqWoxADrgh7UAh2LROsfTKYIQ79sdvlsY4Txg9EesrLXFeiYvPoVSKt-ObLXxVRiqEWChVUwAFOip70QHUa',
            fit: BoxFit.cover,
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: <Color>[
                  StitchTheme.darkText.withValues(alpha: 0.25),
                  StitchTheme.darkText.withValues(alpha: 0.45),
                  StitchTheme.darkText.withValues(alpha: 0.8),
                ],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Column(
                children: <Widget>[
                  const SizedBox(height: 24),
                  Icon(
                    Icons.museum,
                    color: StitchTheme.adwaGold,
                    size: 38,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'EST. 1924',
                    style: StitchTheme.overline(
                      size: 10,
                      color: StitchTheme.muted,
                      letterSpacing: 2.8,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'Heritage Gallery',
                    textAlign: TextAlign.center,
                    style: StitchTheme.headline(
                      size: 52,
                      weight: FontWeight.w600,
                      color: StitchTheme.parchment,
                      height: 1.06,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Experience art through a lens of timeless luxury.',
                    textAlign: TextAlign.center,
                    style: StitchTheme.body(
                      size: 18,
                      weight: FontWeight.w400,
                      color: StitchTheme.muted,
                      height: 1.5,
                    ),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: StitchTheme.adwaGold,
                        foregroundColor: StitchTheme.darkText,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                        textStyle: StitchTheme.body(
                          size: 16,
                          weight: FontWeight.w700,
                          color: StitchTheme.darkText,
                        ),
                      ),
                      onPressed: () {
                        Navigator.pushNamed(context, StitchRoutes.validate);
                      },
                      icon: const Icon(Icons.arrow_forward),
                      label: const Text('Get Started'),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
