import 'package:flutter/material.dart';

import 'stitch_theme.dart';

class StitchNarrationDetailScreen extends StatelessWidget {
  const StitchNarrationDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF151311),
      body: Stack(
        children: <Widget>[
          CustomScrollView(
            slivers: <Widget>[
              SliverToBoxAdapter(
                child: Stack(
                  children: <Widget>[
                    SizedBox(
                      height: 560,
                      width: double.infinity,
                      child: Image.network(
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuDZntEY4cdfVBODI3Ur8TuHBN9uUu1tZ8fzafi64PcBDL3Qo_Rz0ASf1CJeGVWDZAogwc3M4xAGHNsq1IW3LIg-ugsBPC0nUk7SHhIWNAI70iWsyPGdz8Uk3RGMxo_B7p-TzxFptx9ufcpP17jG45FAwe5n3hXqR2VPERuiUtxxjYn2MW-w2zwy3JN4YM4k62YB4Nacv06lAzjFNzz1cCB2lY7haKOHaWl9UfIOLRfpLMJ70-IeX8Lr2g',
                        fit: BoxFit.cover,
                      ),
                    ),
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: <Color>[
                              Colors.transparent,
                              Colors.black.withValues(alpha: 0.65),
                              const Color(0xFF151311),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SliverToBoxAdapter(
                child: Transform.translate(
                  offset: const Offset(0, -70),
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 20),
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 120),
                    decoration: BoxDecoration(
                      color: const Color(0xDD2B2A29),
                      borderRadius: BorderRadius.circular(26),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.08),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          'Golden Tide',
                          style: StitchTheme.headline(
                            size: 34,
                            color: StitchTheme.parchment,
                            weight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Elena Marquez · 1972',
                          style: StitchTheme.body(
                            size: 16,
                            color: StitchTheme.muted,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          "A contemporary abstract seascape capturing the fleeting shimmer of light over a wave. The artist's impasto technique creates tactile movement that shifts with the viewer.",
                          style: StitchTheme.body(
                            size: 18,
                            color: StitchTheme.parchment.withValues(alpha: 0.9),
                            height: 1.55,
                          ),
                        ),
                        const SizedBox(height: 22),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF2C2927),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                'AI GUIDE PROGRESS',
                                style: StitchTheme.overline(
                                  size: 11,
                                  color: StitchTheme.muted,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Chapter 2: The Technique',
                                style: StitchTheme.body(
                                  size: 20,
                                  weight: FontWeight.w500,
                                  color: StitchTheme.parchment,
                                ),
                              ),
                              const SizedBox(height: 14),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(99),
                                child: const LinearProgressIndicator(
                                  value: 0.33,
                                  minHeight: 5,
                                  backgroundColor: Color(0xFF4A443C),
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    StitchTheme.adwaGold,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: <Widget>[
                                  Text(
                                    '0:00',
                                    style: StitchTheme.body(
                                      size: 12,
                                      color: StitchTheme.muted,
                                    ),
                                  ),
                                  Text(
                                    '45:20',
                                    style: StitchTheme.body(
                                      size: 12,
                                      color: StitchTheme.muted,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: <Widget>[
                            Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: StitchTheme.adwaGold.withValues(alpha: 0.2),
                              ),
                              child: const Icon(
                                Icons.record_voice_over,
                                color: StitchTheme.adwaGold,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Live Transcript',
                              style: StitchTheme.body(
                                size: 16,
                                weight: FontWeight.w600,
                                color: StitchTheme.parchment,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.only(left: 12),
                          decoration: const BoxDecoration(
                            border: Border(
                              left: BorderSide(color: StitchTheme.adwaGold, width: 2),
                            ),
                          ),
                          child: Text(
                            '"...notice how the thick application of cadmium yellow creates a physical texture that catches gallery light, simulating the very sun it depicts..."',
                            style: StitchTheme.body(
                              size: 16,
                              color: StitchTheme.parchment.withValues(alpha: 0.82),
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                children: <Widget>[
                  _glassIcon(
                    Icons.arrow_back,
                    onTap: () => Navigator.pop(context),
                  ),
                  const Spacer(),
                  Text(
                    'THE\nGALLERY',
                    textAlign: TextAlign.center,
                    style: StitchTheme.headline(
                      size: 18,
                      color: StitchTheme.parchment,
                      letterSpacing: 2,
                    ),
                  ),
                  const Spacer(),
                  _glassIcon(Icons.more_horiz),
                ],
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xCC2B2A29),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: StitchTheme.adwaGold.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Row(
                    children: <Widget>[
                      IconButton(
                        onPressed: () {},
                        icon: const Icon(Icons.replay_10, color: StitchTheme.parchment),
                      ),
                      Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          color: Color(0xFF383838),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.pause,
                          color: StitchTheme.adwaGold,
                          size: 28,
                        ),
                      ),
                      const Spacer(),
                      FilledButton.icon(
                        onPressed: () {},
                        style: FilledButton.styleFrom(
                          backgroundColor: StitchTheme.adwaGold,
                          foregroundColor: StitchTheme.darkText,
                        ),
                        icon: const Icon(Icons.mic),
                        label: const Text('Ask the Guide'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _glassIcon(IconData icon, {VoidCallback? onTap}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0x99383838),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: StitchTheme.parchment),
        ),
      ),
    );
  }
}
